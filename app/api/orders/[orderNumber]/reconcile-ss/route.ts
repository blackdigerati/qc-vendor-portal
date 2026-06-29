import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { lookupShipments, type SSShipmentItem } from '@/lib/shipstation'
import { writeAudit } from '@/lib/audit'
import { newId } from '@/lib/ids'

function normSku(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}
function normName(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export type ReconcileDiff = {
  orderNumber: string
  ssShipmentIds: string[]
  added: { sku: string; name: string; qty: number; unitCostCents: number }[]
  removed: { id: string; sku: string; name: string; qty: number }[]
  qtyChanged: { id: string; sku: string; name: string; portalQty: number; ssQty: number }[]
  matched: number
}

// GET = diff only (preview)
export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const await_session = await requireSession()
  void await_session
  const { orderNumber } = await params
  const diff = await computeDiff(orderNumber)
  if ('error' in diff) return NextResponse.json(diff, { status: diff.status })
  return NextResponse.json(diff)
}

// POST = apply
export async function POST(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const s = await requireSession()
  const { orderNumber } = await params
  const diff = await computeDiff(orderNumber)
  if ('error' in diff) return NextResponse.json(diff, { status: diff.status })

  // Apply: inserts for "added", cancel for "removed", update qty for "qtyChanged"
  for (const a of diff.added) {
    db.insert(schema.orderItems).values({
      id: newId('oi'),
      orderNumber,
      sku: a.sku,
      name: a.name,
      qty: a.qty,
      costOfGoodsCents: a.unitCostCents,
      status: 'queued',
    }).run()

    // Auto-create SKU if not present (mirrors orders-pull behavior)
    const skuRow = db.select().from(schema.skus).where(eq(schema.skus.sku, a.sku)).get()
    if (!skuRow && a.sku) {
      db.insert(schema.skus).values({
        sku: a.sku, description: a.name, baseCostCents: a.unitCostCents, active: true,
      }).run()
    }
  }
  for (const r of diff.removed) {
    db.update(schema.orderItems).set({ status: 'cancelled' }).where(eq(schema.orderItems.id, r.id)).run()
  }
  for (const c of diff.qtyChanged) {
    db.update(schema.orderItems).set({ qty: c.ssQty }).where(eq(schema.orderItems.id, c.id)).run()
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'order',
    entityId: orderNumber,
    action: 'order.reconciled_with_ss',
    payload: { added: diff.added, removed: diff.removed, qtyChanged: diff.qtyChanged },
  })

  return NextResponse.json({
    ok: true,
    addedCount: diff.added.length,
    removedCount: diff.removed.length,
    qtyChangedCount: diff.qtyChanged.length,
  })
}

async function computeDiff(orderNumber: string): Promise<ReconcileDiff | { error: string; status: number }> {
  const order = db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)).get()
  if (!order) return { error: 'Order not in portal', status: 404 }

  const shipments = await lookupShipments(orderNumber)
  if (shipments.length === 0) return { error: 'No ShipStation shipment found for this order', status: 404 }

  // Collect SS items across all shipments for this order
  const ssItems: SSShipmentItem[] = []
  const ssShipmentIds: string[] = []
  for (const sh of shipments) {
    ssShipmentIds.push(sh.shipment_id)
    for (const it of sh.items ?? []) ssItems.push(it)
  }

  // Portal items in reconcilable state (skip batched/shipped — locked)
  const portalItems = db
    .select()
    .from(schema.orderItems)
    .where(sql`${schema.orderItems.orderNumber} = ${orderNumber} AND ${schema.orderItems.status} IN ('queued','partial')`)
    .all()

  // Match each SS item to a portal item; track which portal items got hit
  const portalMatched = new Set<string>()
  const added: ReconcileDiff['added'] = []
  const qtyChanged: ReconcileDiff['qtyChanged'] = []

  for (const si of ssItems) {
    const sku = normSku(si.sku)
    const name = normName(si.name)
    let pi = sku
      ? portalItems.find(p => normSku(p.sku) === sku && !portalMatched.has(p.id))
      : undefined
    if (!pi && name) {
      pi = portalItems.find(p => normName(p.name) === name && !portalMatched.has(p.id))
    }
    if (!pi) {
      added.push({
        sku: si.sku || '',
        name: si.name || '',
        qty: si.quantity ?? 1,
        unitCostCents: 0,
      })
      continue
    }
    portalMatched.add(pi.id)
    const ssQty = si.quantity ?? pi.qty
    if (ssQty !== pi.qty) {
      qtyChanged.push({ id: pi.id, sku: pi.sku, name: pi.name, portalQty: pi.qty, ssQty })
    }
  }

  const removed = portalItems
    .filter(p => !portalMatched.has(p.id))
    .map(p => ({ id: p.id, sku: p.sku, name: p.name, qty: p.qty }))

  return {
    orderNumber,
    ssShipmentIds,
    added,
    removed,
    qtyChanged,
    matched: portalMatched.size,
  }
}
