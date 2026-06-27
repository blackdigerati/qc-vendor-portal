import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { getShipmentLabels, firstLiveLabel } from '@/lib/shipstation'
import { createInvoiceForBatch } from '@/lib/invoice'
import { writeAudit } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id: batchId } = await params

  const batch = db.select().from(schema.batches).where(eq(schema.batches.id, batchId)).get()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.batchId, batchId)).all()
  if (items.length === 0) return NextResponse.json({ error: 'Empty batch' }, { status: 400 })

  // Group by ssShipmentId; one call per shipment
  const byShipment = new Map<string, typeof items>()
  for (const it of items) {
    if (!it.ssShipmentId) continue
    const arr = byShipment.get(it.ssShipmentId) || []
    arr.push(it)
    byShipment.set(it.ssShipmentId, arr)
  }

  const updates: { orderNumber: string; shipped: boolean; tracking?: string }[] = []
  for (const [shipId, itemsInShipment] of byShipment) {
    const labels = await getShipmentLabels(shipId)
    const live = firstLiveLabel(labels)
    if (!live) continue
    for (const it of itemsInShipment) {
      if (it.status === 'batched') {
        db.update(schema.orderItems).set({ status: 'shipped' }).where(eq(schema.orderItems.id, it.id)).run()
      }
    }
    updates.push({ orderNumber: itemsInShipment[0].orderNumber, shipped: true, tracking: live.tracking_number })
  }

  // Update parent order statuses
  const orderNums = [...new Set(items.map(i => i.orderNumber))]
  for (const on of orderNums) {
    const orderItems = db.select().from(schema.orderItems).where(eq(schema.orderItems.orderNumber, on)).all()
    const allShipped = orderItems.every(i => i.status === 'shipped' || i.status === 'cancelled')
    const someShipped = orderItems.some(i => i.status === 'shipped')
    if (allShipped) {
      db.update(schema.orders).set({ status: 'shipped' }).where(eq(schema.orders.orderNumber, on)).run()
    } else if (someShipped) {
      db.update(schema.orders).set({ status: 'partial' }).where(eq(schema.orders.orderNumber, on)).run()
    }
  }

  // Batch status
  const allBatchItems = db.select().from(schema.orderItems).where(eq(schema.orderItems.batchId, batchId)).all()
  const allShipped = allBatchItems.every(i => i.status === 'shipped' || i.status === 'cancelled')
  const someShipped = allBatchItems.some(i => i.status === 'shipped')
  let invoiceInfo: { invoiceId: string; totalCents: number; warnings: string[] } | null = null
  if (allShipped) {
    db.update(schema.batches).set({ status: 'shipped' }).where(eq(schema.batches.id, batchId)).run()
    const result = await createInvoiceForBatch(batchId, s.userId)
    if ('invoiceId' in result) invoiceInfo = result
  } else if (someShipped) {
    db.update(schema.batches).set({ status: 'partially_shipped' }).where(eq(schema.batches.id, batchId)).run()
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'batch',
    entityId: batchId,
    action: 'batch.refreshed',
    payload: { updates, invoice: invoiceInfo },
  })

  return NextResponse.json({
    batchId,
    updates,
    allShipped,
    invoice: invoiceInfo,
  })
}
