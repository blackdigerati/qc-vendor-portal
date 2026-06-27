import { NextResponse } from 'next/server'
import { eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { lookupShipments, tagShipment, SS_TAG_NAME } from '@/lib/shipstation'
import { writeAudit } from '@/lib/audit'

function nextBatchId(): string {
  const year = new Date().getFullYear()
  const prefix = `B-${year}-`
  const ids = db.select({ id: schema.batches.id }).from(schema.batches).all().map(r => r.id)
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (n > max) max = n
  }
  return prefix + String(max + 1).padStart(4, '0')
}

type PushBody = { itemIds: string[] }

export async function POST(req: Request) {
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Partial<PushBody>
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter(Boolean) : []
  if (itemIds.length === 0) return NextResponse.json({ error: 'No items selected' }, { status: 400 })

  const items = db.select().from(schema.orderItems).where(inArray(schema.orderItems.id, itemIds)).all()
  if (items.length === 0) return NextResponse.json({ error: 'Items not found' }, { status: 404 })
  const stillQueued = items.filter(i => i.status === 'queued')
  if (stillQueued.length === 0) return NextResponse.json({ error: 'Selected items are no longer queued' }, { status: 409 })

  const orderNums = [...new Set(stillQueued.map(i => i.orderNumber))]

  // Detect merge candidates by shared email among the order set
  const allOrders = db.select().from(schema.orders).where(inArray(schema.orders.orderNumber, orderNums)).all()
  const emailGroups = new Map<string, string[]>()
  for (const o of allOrders) {
    const arr = emailGroups.get(o.email) || []
    arr.push(o.orderNumber)
    emailGroups.set(o.email, arr)
  }
  const mergedSet = new Set<string>()
  for (const [, arr] of emailGroups) if (arr.length > 1) arr.forEach(o => mergedSet.add(o))

  const batchId = nextBatchId()
  const batchTag = `Batch-${batchId}`
  db.insert(schema.batches).values({
    id: batchId,
    createdBy: s.userId,
    status: 'pending',
  }).run()

  let tagged = 0
  const ssFailures: { orderNumber: string; reason: string }[] = []
  const orderSsMap = new Map<string, string>() // orderNumber -> ssShipmentId (first found)

  for (const orderNumber of orderNums) {
    const ships = await lookupShipments(orderNumber)
    if (ships.length === 0) {
      ssFailures.push({ orderNumber, reason: 'no shipment in ShipStation' })
      continue
    }
    const shipmentId = ships[0].shipment_id
    orderSsMap.set(orderNumber, shipmentId)
    const t1 = await tagShipment(shipmentId, SS_TAG_NAME)
    const t2 = await tagShipment(shipmentId, batchTag)
    if (!t1 || !t2) {
      ssFailures.push({ orderNumber, reason: `tag failed (shipping=${t1}, batch=${t2})` })
      continue
    }
    if (mergedSet.has(orderNumber)) await tagShipment(shipmentId, 'Merge')
    tagged++
  }

  // Persist item + order updates regardless of SS failures (SS can be retried)
  for (const it of stillQueued) {
    const ssId = orderSsMap.get(it.orderNumber)
    db.update(schema.orderItems)
      .set({ status: 'batched', batchId, ssShipmentId: ssId })
      .where(eq(schema.orderItems.id, it.id))
      .run()
  }

  for (const orderNumber of orderNums) {
    const remaining = db.select({ c: sql<number>`count(*)` })
      .from(schema.orderItems)
      .where(sql`${schema.orderItems.orderNumber} = ${orderNumber} AND ${schema.orderItems.status} = 'queued'`)
      .get()?.c ?? 0
    const newStatus = remaining > 0 ? 'partial' : 'batched'
    db.update(schema.orders)
      .set({ status: newStatus as 'partial' | 'batched' })
      .where(eq(schema.orders.orderNumber, orderNumber))
      .run()
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'batch',
    entityId: batchId,
    action: 'batch.created',
    payload: {
      orderNumbers: orderNums,
      itemsBatched: stillQueued.length,
      tagged,
      ssFailures,
    },
  })

  return NextResponse.json({
    batchId,
    total: orderNums.length,
    tagged,
    failures: ssFailures,
  })
}
