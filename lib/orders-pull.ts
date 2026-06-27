import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { newId } from './ids'
import { detectUrgent, OrderRow } from './orders-source'
import { writeAudit } from './audit'

export type PullResult = {
  ordersInserted: number
  ordersSkipped: number // already existed
  itemsInserted: number
  urgentTotal: number
  missingSkus: string[]
  source: 'sheet' | 'upload'
}

export async function pullOrders(
  rows: OrderRow[],
  opts: { source: 'sheet' | 'upload'; urgentOrderNumbers?: string[]; actor?: string },
): Promise<PullResult> {
  const urgentSet = new Set((opts.urgentOrderNumbers || []).map(s => s.trim()).filter(Boolean))
  const result: PullResult = {
    ordersInserted: 0,
    ordersSkipped: 0,
    itemsInserted: 0,
    urgentTotal: 0,
    missingSkus: [],
    source: opts.source,
  }

  // Group rows by orderNumber
  const byOrder = new Map<string, OrderRow[]>()
  for (const r of rows) {
    const arr = byOrder.get(r.orderNumber) || []
    arr.push(r)
    byOrder.set(r.orderNumber, arr)
  }

  const skuCache = new Set(
    db.select({ sku: schema.skus.sku }).from(schema.skus).all().map(r => r.sku),
  )

  const missing = new Set<string>()

  for (const [orderNumber, items] of byOrder) {
    const head = items[0]
    const existing = db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)).get()
    if (existing) {
      result.ordersSkipped++
      continue
    }
    const urgent = urgentSet.has(orderNumber) || items.some(i => detectUrgent(i.notes))
    db.insert(schema.orders).values({
      orderNumber,
      email: head.email,
      firstName: head.firstName,
      lastName: head.lastName,
      address1: head.address1,
      address2: head.address2,
      city: head.city,
      state: head.state,
      zip: head.zip,
      country: head.country,
      notes: items.map(i => i.notes).filter(Boolean).join(' | '),
      urgent,
      source: opts.source,
      status: 'queued',
    }).run()
    result.ordersInserted++
    if (urgent) result.urgentTotal++

    for (const it of items) {
      db.insert(schema.orderItems).values({
        id: newId('oi'),
        orderNumber,
        sku: it.sku,
        name: it.name,
        qty: it.qty,
        costOfGoodsCents: it.costOfGoodsCents,
        status: 'queued',
      }).run()
      result.itemsInserted++
      if (it.sku && !skuCache.has(it.sku)) missing.add(it.sku)
    }
  }

  result.missingSkus = [...missing].sort()
  await writeAudit({
    actor: opts.actor,
    entityType: 'pull',
    entityId: new Date().toISOString(),
    action: 'orders.pulled',
    payload: result,
  })
  return result
}
