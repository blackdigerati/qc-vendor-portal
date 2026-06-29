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
    await db.insert(schema.orderItems).values({
      id: newId('oi'),
      orderNumber,
      sku: a.sku,
      name: a.name,
      qty: a.qty,
      costOfGoodsCents: a.unitCostCents,
      status: 'queued',
    })

    // Auto-create SKU if not present (mirrors orders-pull behavior)
    const skuRow = (await db.select().from(schema.skus).where(eq(schema.skus.sku, a.sku)))[0]
    if (!skuRow && a.sku) {
      await db.insert(schema.skus).values({
        sku: a.sku, description: a.name, baseCostCents: a.unitCostCents, active: true,
      })
    }
  }
  for (const r of diff.removed) {
    await db.update(schema.orderItems).set({ status: 'cancelled' }).where(eq(schema.orderItems.id, r.id))
  }
  for (const c of diff.qtyChanged) {
    await db.update(schema.orderItems).set({ qty: c.ssQty }).where(eq(schema.orderItems.id, c.id))
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
  const order = (await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)))[0]
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

  // Pull ALL live portal items for the order — we need shipped items in the
  // match pool so they're recognized as already-on-SS (otherwise reconcile
  // would re-add every previously-shipped item as "missing" on a partial order).
  // Only queued items are eligible for "remove" (you can't un-ship).
  const portalItems = await db
    .select()
    .from(schema.orderItems)
    .where(sql`${schema.orderItems.orderNumber} = ${orderNumber} AND ${schema.orderItems.status} IN ('queued','shipped','batched')`)

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
      // SS doesn't carry prices — look up the SKU's COG in our catalog so the
      // new portal item gets the right price for invoicing.
      let unitCostCents = 0
      if (si.sku) {
        const skuRow = (await db.select().from(schema.skus).where(eq(schema.skus.sku, si.sku)))[0]
        if (skuRow) unitCostCents = skuRow.baseCostCents
      }
      added.push({
        sku: si.sku || '',
        name: si.name || '',
        qty: si.quantity ?? 1,
        unitCostCents,
      })
      continue
    }
    portalMatched.add(pi.id)
    const ssQty = si.quantity ?? pi.qty
    // Only suggest qty changes on queued items. Shipped items are locked-in
    // and we shouldn't try to "correct" their qty after the fact.
    if (ssQty !== pi.qty && pi.status === 'queued') {
      qtyChanged.push({ id: pi.id, sku: pi.sku, name: pi.name, portalQty: pi.qty, ssQty })
    }
  }

  // Only queued portal items are eligible for "cancel in portal" — shipped
  // items can't be un-shipped via reconcile.
  const removed = portalItems
    .filter(p => p.status === 'queued' && !portalMatched.has(p.id))
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
