import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { getShipment, listRecentLabels, type SSShipmentItem } from '@/lib/shipstation'
import { writeAudit } from '@/lib/audit'

const DEFAULT_LOOKBACK_HOURS = 24

type Body = {
  sinceISO?: string    // override the cursor with a custom "fetch labels created after this"
  maxLabels?: number   // hard cap on labels scanned this run (testing safety)
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

function pickSinceISO(): string {
  const cursor = db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)).get()
  if (cursor?.lastLabelFetchAt) return cursor.lastLabelFetchAt.toISOString()
  const fallback = new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000)
  return fallback.toISOString()
}

function normSku(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}

export async function POST(req: Request) {
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Body
  const overrideSince = typeof body.sinceISO === 'string' && body.sinceISO ? new Date(body.sinceISO) : null
  const sinceISO = overrideSince ? overrideSince.toISOString() : pickSinceISO()
  const maxLabels = typeof body.maxLabels === 'number' && body.maxLabels > 0 ? body.maxLabels : undefined
  const usingOverride = !!overrideSince
  const fetchedAt = new Date()

  let labels
  try {
    labels = await listRecentLabels(sinceISO)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'SS fetch failed' }, { status: 502 })
  }
  if (maxLabels && labels.length > maxLabels) labels = labels.slice(0, maxLabels)

  // Dedupe by shipment_id; drop any shipments we've already imported into an order_item batch
  const seenShipIds = new Set(
    db
      .select({ id: schema.orderItems.ssShipmentId })
      .from(schema.orderItems)
      .where(sql`${schema.orderItems.ssShipmentId} IS NOT NULL`)
      .all()
      .map(r => r.id!)
      .filter(Boolean),
  )

  const newShipIds: string[] = []
  for (const l of labels) {
    if (!l.shipment_id) continue
    if (seenShipIds.has(l.shipment_id)) continue
    if (!newShipIds.includes(l.shipment_id)) newShipIds.push(l.shipment_id)
  }

  if (newShipIds.length === 0) {
    // Only bump cursor on a normal (non-override) run
    if (!usingOverride) upsertCursor(fetchedAt)
    return NextResponse.json({
      batchId: null,
      sinceISO,
      labelsScanned: labels.length,
      shipmentsImported: 0,
      ordersTouched: 0,
      itemsBatched: 0,
      unmatchedShipments: 0,
      message: 'No new labels since last fetch',
    })
  }

  const summary = {
    shipmentsImported: 0,
    ordersTouched: new Set<string>(),
    itemsBatched: 0,
    partialOrders: new Set<string>(),
    fullyShippedOrders: new Set<string>(),
    unmatchedShipments: [] as { shipmentId: string; reason: string }[],
    unmatchedItems: [] as { orderNumber: string; sku: string; qty: number }[],
  }

  const batchId = nextBatchId()
  db.insert(schema.batches).values({
    id: batchId,
    createdBy: s.userId,
    status: 'pending',
    source: 'ss_label_sync',
    labelFetchAt: fetchedAt,
  }).run()

  for (const shipmentId of newShipIds) {
    const ship = await getShipment(shipmentId)
    if (!ship) {
      summary.unmatchedShipments.push({ shipmentId, reason: 'GET /shipments returned null' })
      continue
    }
    const orderNumber = ship.external_shipment_id || ship.order_number
    if (!orderNumber) {
      summary.unmatchedShipments.push({ shipmentId, reason: 'no external_shipment_id on shipment' })
      continue
    }
    const dbOrder = db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)).get()
    if (!dbOrder) {
      summary.unmatchedShipments.push({ shipmentId, reason: `order #${orderNumber} not in portal DB — pull it first` })
      continue
    }

    const queuedItems = db.select().from(schema.orderItems)
      .where(sql`${schema.orderItems.orderNumber} = ${orderNumber}`)
      .all()
      .filter(i => i.status === 'queued')

    const shipItems: SSShipmentItem[] = ship.items || []

    // Match each SS shipment item to a queued item by SKU
    const matchedQueueIds = new Set<string>()
    for (const si of shipItems) {
      const sku = normSku(si.sku)
      if (!sku) continue
      const candidate = queuedItems.find(qi => normSku(qi.sku) === sku && !matchedQueueIds.has(qi.id))
      if (!candidate) {
        summary.unmatchedItems.push({ orderNumber, sku: si.sku || '', qty: si.quantity ?? 0 })
        continue
      }
      matchedQueueIds.add(candidate.id)
      db.update(schema.orderItems).set({
        status: 'shipped',
        batchId,
        ssShipmentId: shipmentId,
      }).where(eq(schema.orderItems.id, candidate.id)).run()
      summary.itemsBatched++
    }

    // Recompute parent order status
    const stillQueued = queuedItems.filter(qi => !matchedQueueIds.has(qi.id)).length
    if (stillQueued === 0 && matchedQueueIds.size > 0) {
      db.update(schema.orders).set({ status: 'shipped' })
        .where(eq(schema.orders.orderNumber, orderNumber)).run()
      summary.fullyShippedOrders.add(orderNumber)
    } else if (matchedQueueIds.size > 0) {
      db.update(schema.orders).set({ status: 'partial' })
        .where(eq(schema.orders.orderNumber, orderNumber)).run()
      summary.partialOrders.add(orderNumber)
    }

    if (matchedQueueIds.size > 0) {
      summary.ordersTouched.add(orderNumber)
      summary.shipmentsImported++
      // Promote ssShipmentId to the order itself if not yet set
      if (!dbOrder.ssShipmentId) {
        db.update(schema.orders).set({ ssShipmentId: shipmentId })
          .where(eq(schema.orders.orderNumber, orderNumber)).run()
      }
    }
  }

  // If nothing actually got into the batch (every shipment unmatched), drop the empty batch
  if (summary.itemsBatched === 0) {
    db.delete(schema.batches).where(eq(schema.batches.id, batchId)).run()
    if (!usingOverride) upsertCursor(fetchedAt)
    return NextResponse.json({
      batchId: null,
      sinceISO,
      labelsScanned: labels.length,
      shipmentsImported: 0,
      ordersTouched: 0,
      itemsBatched: 0,
      partialOrders: 0,
      fullyShippedOrders: 0,
      unmatchedShipments: summary.unmatchedShipments.length,
      unmatchedItems: summary.unmatchedItems.length,
      message:
        summary.unmatchedShipments.length > 0
          ? `Found ${summary.unmatchedShipments.length} shipped order${summary.unmatchedShipments.length === 1 ? '' : 's'} in ShipStation, but none match orders in the portal queue. Pull the orders into the queue first.`
          : 'No matching shipped orders to batch.',
      detail: {
        unmatchedShipments: summary.unmatchedShipments,
        unmatchedItems: summary.unmatchedItems,
      },
    })
  }

  // Roll up batch status
  db.update(schema.batches).set({
    status: 'shipped',
  }).where(eq(schema.batches.id, batchId)).run()

  // Only advance the cursor on a normal (non-override) run, so testers
  // can re-fetch historical ranges without losing their place.
  if (!usingOverride) upsertCursor(fetchedAt)

  const payload = {
    batchId,
    sinceISO,
    labelsScanned: labels.length,
    shipmentsImported: summary.shipmentsImported,
    ordersTouched: summary.ordersTouched.size,
    itemsBatched: summary.itemsBatched,
    partialOrders: summary.partialOrders.size,
    fullyShippedOrders: summary.fullyShippedOrders.size,
    unmatchedShipments: summary.unmatchedShipments.length,
    unmatchedItems: summary.unmatchedItems.length,
    detail: {
      unmatchedShipments: summary.unmatchedShipments,
      unmatchedItems: summary.unmatchedItems,
    },
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'batch',
    entityId: batchId,
    action: 'batch.label_fetch',
    payload,
  })

  return NextResponse.json(payload)
}

function upsertCursor(at: Date) {
  const existing = db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)).get()
  if (existing) {
    db.update(schema.ssSyncCursor)
      .set({ lastLabelFetchAt: at, updatedAt: at })
      .where(eq(schema.ssSyncCursor.id, 1))
      .run()
  } else {
    db.insert(schema.ssSyncCursor).values({ id: 1, lastLabelFetchAt: at }).run()
  }
}
