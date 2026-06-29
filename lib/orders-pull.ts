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
  skusCreated: string[] // auto-created SKUs (new to the catalog)
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
    skusCreated: [],
    source: opts.source,
  }

  // Group rows by orderNumber
  const byOrder = new Map<string, OrderRow[]>()
  for (const r of rows) {
    const arr = byOrder.get(r.orderNumber) || []
    arr.push(r)
    byOrder.set(r.orderNumber, arr)
  }

  // In-memory cache of known SKUs (grows as we auto-create within this pull)
  const skuCache = new Set(
    db.select({ sku: schema.skus.sku }).from(schema.skus).all().map(r => r.sku),
  )
  const created = new Set<string>()

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
      notes: [
        ...new Set(
          items
            .map(i => (i.notes || '').replace(/\burgent\b/gi, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        ),
      ].join(' | '),
      urgent,
      source: opts.source,
      status: 'queued',
    }).run()
    result.ordersInserted++
    if (urgent) result.urgentTotal++

    for (const it of items) {
      // Auto-create the SKU on first sight. Never overwrite an existing one
      // (the CSV could carry a typo / stale cost — Settings is authoritative
      // once a SKU has been touched).
      if (it.sku && !skuCache.has(it.sku)) {
        db.insert(schema.skus).values({
          sku: it.sku,
          description: it.name,
          baseCostCents: it.costOfGoodsCents,
          active: true,
        }).run()
        skuCache.add(it.sku)
        created.add(it.sku)
      }

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
    }
  }

  result.skusCreated = [...created].sort()

  await writeAudit({
    actor: opts.actor,
    entityType: 'pull',
    entityId: new Date().toISOString(),
    action: 'orders.pulled',
    payload: result,
  })
  return result
}
