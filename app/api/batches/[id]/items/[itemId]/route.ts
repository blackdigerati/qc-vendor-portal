import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

type Body =
  | { action: 'reduce_qty'; qty: number; reason?: string }
  | { action: 'remove'; reason?: string; bounceToQueue?: boolean }

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const s = await requireSession()
  const { id: batchId, itemId } = await params
  const body = (await req.json().catch(() => ({}))) as Partial<Body>

  const batch = (await db.select().from(schema.batches).where(eq(schema.batches.id, batchId)))[0]
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.invoiceId) {
    return NextResponse.json({
      error: `Cannot edit — batch is already invoiced (${batch.invoiceId}). Delete the invoice first if you need to change items.`,
    }, { status: 409 })
  }

  const item = (await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)))[0]
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (item.batchId !== batchId) return NextResponse.json({ error: 'Item not in this batch' }, { status: 400 })

  const reason = String(body.reason ?? '').slice(0, 500)

  if (body.action === 'reduce_qty') {
    const newQty = Math.max(1, Math.floor(Number(body.qty) || 0))
    if (newQty >= item.qty) {
      return NextResponse.json({ error: 'New qty must be less than current qty. To remove the whole line, use remove.' }, { status: 400 })
    }
    const removedQty = item.qty - newQty
    await db.update(schema.orderItems).set({ qty: newQty }).where(eq(schema.orderItems.id, itemId))

    // Bounce the remainder back to the queue as a new line item, so the order
    // still tracks what was unfulfilled. Same SKU, same order#, qty = removed amount, status queued.
    const remainderId = 'oi_' + Math.random().toString(36).slice(2, 14).toUpperCase()
    await db.insert(schema.orderItems).values({
      id: remainderId,
      orderNumber: item.orderNumber,
      sku: item.sku,
      name: item.name,
      qty: removedQty,
      costOfGoodsCents: item.costOfGoodsCents,
      status: 'queued',
      notes: reason ? `Bounced from batch ${batchId}: ${reason}` : `Bounced from batch ${batchId}`,
    })

    // Parent order goes back to partial if it was 'shipped'
    await db.update(schema.orders).set({ status: 'partial' })
      .where(eq(schema.orders.orderNumber, item.orderNumber))

    await writeAudit({
      actor: s.userId,
      entityType: 'batch_item',
      entityId: itemId,
      action: 'batch.item.qty_reduced',
      payload: { batchId, oldQty: item.qty, newQty, bouncedQty: removedQty, remainderItemId: remainderId, reason },
    })

    return NextResponse.json({ ok: true, oldQty: item.qty, newQty, bouncedQty: removedQty, remainderItemId: remainderId })
  }

  if (body.action === 'remove') {
    const bounce = body.bounceToQueue !== false // default true
    if (bounce) {
      // Send the item back to the queue: clear batch link, status → queued.
      await db.update(schema.orderItems).set({
        status: 'queued',
        batchId: null,
        ssShipmentId: null,
        notes: reason
          ? `${item.notes ? item.notes + ' · ' : ''}Pulled from batch ${batchId}: ${reason}`.slice(0, 2000)
          : item.notes,
      }).where(eq(schema.orderItems.id, itemId))
    } else {
      // Fully cancel the item.
      await db.update(schema.orderItems).set({
        status: 'cancelled',
        notes: reason
          ? `${item.notes ? item.notes + ' · ' : ''}Cancelled from batch ${batchId}: ${reason}`.slice(0, 2000)
          : item.notes,
      }).where(eq(schema.orderItems.id, itemId))
    }

    // Order status: if any items still in this batch shipped, parent stays "shipped" / "partial";
    // otherwise back to queued/partial.
    const remaining = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderNumber, item.orderNumber))
    const anyQueued = remaining.some(r => r.status === 'queued')
    const anyShipped = remaining.some(r => r.status === 'shipped')
    const newOrderStatus = anyShipped && anyQueued ? 'partial' : anyShipped ? 'shipped' : anyQueued ? 'queued' : 'cancelled'
    await db.update(schema.orders).set({ status: newOrderStatus })
      .where(eq(schema.orders.orderNumber, item.orderNumber))

    await writeAudit({
      actor: s.userId,
      entityType: 'batch_item',
      entityId: itemId,
      action: bounce ? 'batch.item.bounced_to_queue' : 'batch.item.cancelled',
      payload: { batchId, orderNumber: item.orderNumber, sku: item.sku, qty: item.qty, reason, newOrderStatus },
    })

    return NextResponse.json({ ok: true, bouncedToQueue: bounce })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
