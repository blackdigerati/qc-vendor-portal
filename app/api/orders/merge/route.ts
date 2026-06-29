import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { addShipmentNote, lookupShipments, mergeShipments, tagShipment } from '@/lib/shipstation'
import { writeAudit } from '@/lib/audit'

type Body = {
  keepOrderNumber: string
  mergeOrderNumbers: string[]
}

async function resolveShipmentId(orderNumber: string, cachedId: string | null): Promise<string | null> {
  if (cachedId) return cachedId
  const ships = await lookupShipments(orderNumber)
  return ships[0]?.shipment_id ?? null
}

export async function POST(req: Request) {
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  const keep = String(body.keepOrderNumber || '').trim()
  const mergeList = (Array.isArray(body.mergeOrderNumbers) ? body.mergeOrderNumbers : [])
    .map(x => String(x || '').trim())
    .filter(Boolean)
    .filter(x => x !== keep)

  if (!keep || mergeList.length === 0) {
    return NextResponse.json({ error: 'keepOrderNumber + at least one mergeOrderNumber required' }, { status: 400 })
  }

  const allNums = [keep, ...mergeList]
  const allOrders = await db.select().from(schema.orders).where(inArray(schema.orders.orderNumber, allNums))
  const orderMap = new Map(allOrders.map(o => [o.orderNumber, o]))

  const keepOrder = orderMap.get(keep)
  if (!keepOrder) return NextResponse.json({ error: `Surviving order #${keep} not found` }, { status: 404 })

  const keepShipId = await resolveShipmentId(keep, keepOrder.ssShipmentId)
  if (!keepShipId) {
    return NextResponse.json({ error: `Surviving order #${keep} has no ShipStation shipment` }, { status: 409 })
  }

  const results: {
    orderNumber: string
    ok: boolean
    fallbackUsed: boolean
    detail: string
  }[] = []

  for (const merge of mergeList) {
    const mergeOrder = orderMap.get(merge)
    if (!mergeOrder) {
      results.push({ orderNumber: merge, ok: false, fallbackUsed: false, detail: 'order not in DB' })
      continue
    }
    const mergeShipId = await resolveShipmentId(merge, mergeOrder.ssShipmentId)
    if (!mergeShipId) {
      results.push({ orderNumber: merge, ok: false, fallbackUsed: false, detail: 'no ShipStation shipment' })
      continue
    }

    const apiResult = await mergeShipments(keepShipId, mergeShipId)
    let fallbackUsed = false
    let detail = apiResult.detail
    if (!apiResult.ok) {
      fallbackUsed = true
      const note = `MERGE — combine with order #${keep} (shipment ${keepShipId}). Initiated via vendor portal.`
      const noteKeep = `MERGE — combine with order #${merge} (shipment ${mergeShipId}). Initiated via vendor portal.`
      await Promise.all([
        addShipmentNote(mergeShipId, note).catch(() => false),
        addShipmentNote(keepShipId, noteKeep).catch(() => false),
        tagShipment(mergeShipId, 'Merge').catch(() => false),
        tagShipment(keepShipId, 'Merge').catch(() => false),
      ])
      detail = `${detail}; wrote notes + tag on both shipments — vendor to finish in SS UI`
    }

    // Move all order_items from the absorbed order onto the survivor.
    // Stamp mergedFromOrderNumber so the UI can show "— from #merge" provenance.
    const movedItems = await db.update(schema.orderItems)
      .set({ orderNumber: keep, mergedFromOrderNumber: merge })
      .where(eq(schema.orderItems.orderNumber, merge))

    await db.update(schema.orders).set({
      mergedIntoOrderNumber: keep,
      status: 'cancelled',
    }).where(eq(schema.orders.orderNumber, merge))

    results.push({
      orderNumber: merge,
      ok: true,
      fallbackUsed,
      detail: `${detail}; moved ${movedItems.rowsAffected} item(s) to survivor`,
    })
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'merge',
    entityId: keep,
    action: 'orders.merged',
    payload: { keep, mergeList, results },
  })

  return NextResponse.json({
    keepOrderNumber: keep,
    merged: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    anyFallback: results.some(r => r.fallbackUsed),
    results,
  })
}
