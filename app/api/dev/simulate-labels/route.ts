import { NextResponse } from 'next/server'
import { eq, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

// Dev-only: simulate a ShipStation label fetch without calling SS.
// Pick queued item IDs; the route mirrors what /api/batches/fetch-labels does
// (creates a batch, marks items shipped + batched, recomputes order status).
type Body = {
  itemIds: string[]
}

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

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev tool not available in production' }, { status: 403 })
  }
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter(Boolean) : []
  if (itemIds.length === 0) return NextResponse.json({ error: 'No items selected' }, { status: 400 })

  const items = db.select().from(schema.orderItems).where(inArray(schema.orderItems.id, itemIds)).all()
  const queued = items.filter(i => i.status === 'queued')
  if (queued.length === 0) return NextResponse.json({ error: 'Selected items are no longer queued' }, { status: 409 })

  const batchId = nextBatchId()
  const now = new Date()
  const fakeShipmentBase = 'sim_' + now.getTime().toString(36)

  db.insert(schema.batches).values({
    id: batchId,
    createdBy: s.userId,
    status: 'shipped',
    source: 'ss_label_sync',
    labelFetchAt: now,
  }).run()

  const orderNums = [...new Set(queued.map(i => i.orderNumber))]

  // Assign a unique fake shipment ID per order so it looks like real SS data
  const shipMap = new Map<string, string>()
  for (const [idx, on] of orderNums.entries()) {
    shipMap.set(on, `${fakeShipmentBase}_${idx}`)
  }

  for (const it of queued) {
    const ssId = shipMap.get(it.orderNumber)!
    db.update(schema.orderItems).set({
      status: 'shipped',
      batchId,
      ssShipmentId: ssId,
    }).where(eq(schema.orderItems.id, it.id)).run()
  }

  // Recompute parent order statuses
  const summary = { partialOrders: 0, fullyShippedOrders: 0 }
  for (const on of orderNums) {
    const remaining = db
      .select({ c: sql<number>`count(*)` })
      .from(schema.orderItems)
      .where(sql`${schema.orderItems.orderNumber} = ${on} AND ${schema.orderItems.status} = 'queued'`)
      .get()?.c ?? 0
    if (remaining === 0) {
      db.update(schema.orders).set({ status: 'shipped' })
        .where(eq(schema.orders.orderNumber, on)).run()
      summary.fullyShippedOrders++
    } else {
      db.update(schema.orders).set({ status: 'partial' })
        .where(eq(schema.orders.orderNumber, on)).run()
      summary.partialOrders++
    }
    const ssId = shipMap.get(on)!
    db.update(schema.orders).set({ ssShipmentId: ssId })
      .where(eq(schema.orders.orderNumber, on)).run()
  }

  // Bump cursor so a real Fetch Printed Labels after this picks up only newer ones
  const cur = db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)).get()
  if (cur) {
    db.update(schema.ssSyncCursor).set({ lastLabelFetchAt: now, updatedAt: now })
      .where(eq(schema.ssSyncCursor.id, 1)).run()
  } else {
    db.insert(schema.ssSyncCursor).values({ id: 1, lastLabelFetchAt: now }).run()
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'batch',
    entityId: batchId,
    action: 'batch.simulated_label_fetch',
    payload: {
      itemsBatched: queued.length,
      orders: orderNums,
      partialOrders: summary.partialOrders,
      fullyShippedOrders: summary.fullyShippedOrders,
    },
  })

  return NextResponse.json({
    batchId,
    itemsBatched: queued.length,
    ordersTouched: orderNums.length,
    partialOrders: summary.partialOrders,
    fullyShippedOrders: summary.fullyShippedOrders,
  })
}
