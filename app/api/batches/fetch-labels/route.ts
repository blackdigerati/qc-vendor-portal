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

async function nextBatchId(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `B-${year}-`
  const ids = (await db.select({ id: schema.batches.id }).from(schema.batches)).map(r => r.id)
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (n > max) max = n
  }
  return prefix + String(max + 1).padStart(4, '0')
}

async function pickSinceISO(): Promise<string> {
  const cursor = (await db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)))[0]
  if (cursor?.lastLabelFetchAt) return cursor.lastLabelFetchAt.toISOString()
  const fallback = new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000)
  return fallback.toISOString()
}

function normSku(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}

function normName(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function POST(req: Request) {
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Body
  const overrideSince = typeof body.sinceISO === 'string' && body.sinceISO ? new Date(body.sinceISO) : null
  const sinceISO = overrideSince ? overrideSince.toISOString() : await pickSinceISO()
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
    (await db
      .select({ id: schema.orderItems.ssShipmentId })
      .from(schema.orderItems)
      .where(sql`${schema.orderItems.ssShipmentId} IS NOT NULL`))
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
    if (!usingOverride) await upsertCursor(fetchedAt)
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

  const batchId = await nextBatchId()
  await db.insert(schema.batches).values({
    id: batchId,
    createdBy: s.userId,
    status: 'pending',
    source: 'ss_label_sync',
    labelFetchAt: fetchedAt,
  })

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
    const dbOrder = (await db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)))[0]
    if (!dbOrder) {
      summary.unmatchedShipments.push({ shipmentId, reason: `order #${orderNumber} not in portal DB — pull it first` })
      continue
    }

    const queuedItems = (await db.select().from(schema.orderItems)
      .where(sql`${schema.orderItems.orderNumber} = ${orderNumber}`))
      .filter(i => i.status === 'queued')

    const shipItems: SSShipmentItem[] = ship.items || []

    // Match each SS shipment item to a queued item. SS often returns items with
    // empty SKU, so we try in order: SKU exact → name exact → single-item fallback.
    const matchedQueueIds = new Set<string>()
    for (const si of shipItems) {
      const sku = normSku(si.sku)
      const name = normName(si.name)

      let candidate = sku
        ? queuedItems.find(qi => normSku(qi.sku) === sku && !matchedQueueIds.has(qi.id))
        : undefined

      if (!candidate && name) {
        candidate = queuedItems.find(qi => normName(qi.name) === name && !matchedQueueIds.has(qi.id))
      }

      // Last-resort: if there's exactly one unmatched item on each side and no
      // identifier at all, match them positionally.
      if (!candidate && !sku && !name) {
        const remaining = queuedItems.filter(qi => !matchedQueueIds.has(qi.id))
        if (remaining.length === 1 && shipItems.length === 1) candidate = remaining[0]
      }

      if (!candidate) {
        summary.unmatchedItems.push({ orderNumber, sku: si.sku || '', qty: si.quantity ?? 0 })
        continue
      }
      matchedQueueIds.add(candidate.id)
      await db.update(schema.orderItems).set({
        status: 'shipped',
        batchId,
        ssShipmentId: shipmentId,
      }).where(eq(schema.orderItems.id, candidate.id))
      summary.itemsBatched++
    }

    // Recompute parent order status
    const stillQueued = queuedItems.filter(qi => !matchedQueueIds.has(qi.id)).length
    if (stillQueued === 0 && matchedQueueIds.size > 0) {
      await db.update(schema.orders).set({ status: 'shipped' })
        .where(eq(schema.orders.orderNumber, orderNumber))
      summary.fullyShippedOrders.add(orderNumber)
    } else if (matchedQueueIds.size > 0) {
      await db.update(schema.orders).set({ status: 'partial' })
        .where(eq(schema.orders.orderNumber, orderNumber))
      summary.partialOrders.add(orderNumber)
    }

    if (matchedQueueIds.size > 0) {
      summary.ordersTouched.add(orderNumber)
      summary.shipmentsImported++
      // Promote ssShipmentId to the order itself if not yet set
      if (!dbOrder.ssShipmentId) {
        await db.update(schema.orders).set({ ssShipmentId: shipmentId })
          .where(eq(schema.orders.orderNumber, orderNumber))
      }
    }
  }

  // If nothing actually got into the batch (every shipment unmatched), drop the empty batch
  if (summary.itemsBatched === 0) {
    await db.delete(schema.batches).where(eq(schema.batches.id, batchId))
    if (!usingOverride) await upsertCursor(fetchedAt)
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
      message: (() => {
        const unmatchedOrders = summary.unmatchedShipments.length
        const unmatchedItems = summary.unmatchedItems.length
        if (unmatchedItems > 0 && unmatchedOrders === 0) {
          return `Found ${unmatchedItems} shipped item${unmatchedItems === 1 ? '' : 's'} matched to portal orders, but couldn't pair them to queued line items (SKU + name both differ). Check that the order's items in the portal match what shipped.`
        }
        if (unmatchedOrders > 0 && unmatchedItems === 0) {
          return `Found ${unmatchedOrders} shipped order${unmatchedOrders === 1 ? '' : 's'} in ShipStation, but none match orders in the portal queue. Pull the orders into the queue first.`
        }
        if (unmatchedOrders > 0 || unmatchedItems > 0) {
          return `Found ${unmatchedOrders} unmatched order${unmatchedOrders === 1 ? '' : 's'} and ${unmatchedItems} unmatched line item${unmatchedItems === 1 ? '' : 's'}. Nothing batched.`
        }
        return 'No matching shipped orders to batch.'
      })(),
      detail: {
        unmatchedShipments: summary.unmatchedShipments,
        unmatchedItems: summary.unmatchedItems,
      },
    })
  }

  // Roll up batch status
  await db.update(schema.batches).set({
    status: 'shipped',
  }).where(eq(schema.batches.id, batchId))

  // Only advance the cursor on a normal (non-override) run, so testers
  // can re-fetch historical ranges without losing their place.
  if (!usingOverride) await upsertCursor(fetchedAt)

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

async function upsertCursor(at: Date) {
  const existing = (await db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)))[0]
  if (existing) {
    await db.update(schema.ssSyncCursor)
      .set({ lastLabelFetchAt: at, updatedAt: at })
      .where(eq(schema.ssSyncCursor.id, 1))
  } else {
    await db.insert(schema.ssSyncCursor).values({ id: 1, lastLabelFetchAt: at })
  }
}
