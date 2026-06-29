import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

type Body = {
  statusFlag?: 'out_of_stock' | 'backordered' | 'discontinued' | 'other' | null
  pendingUntil?: string | null // ISO date
  notes?: string
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Body

  const existing = db.select().from(schema.orderItems).where(eq(schema.orderItems.id, id)).get()
  if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const patch: Partial<typeof schema.orderItems.$inferInsert> = {}
  const statusFlagChanged = 'statusFlag' in body
  const pendingChanged = 'pendingUntil' in body
  const notesChanged = 'notes' in body

  if (statusFlagChanged) patch.statusFlag = body.statusFlag ?? null
  if (pendingChanged) {
    patch.pendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
  }
  if (notesChanged) patch.notes = String(body.notes ?? '').slice(0, 2000)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  db.update(schema.orderItems).set(patch).where(eq(schema.orderItems.id, id)).run()

  // SKU-level propagation: if status flag was touched and we have a sku,
  // mirror the change to the SKU row AND every other queued/partial order_items
  // sharing that SKU. This is what makes "flag once → applies everywhere" work.
  let propagated = 0
  if (existing.sku && (statusFlagChanged || pendingChanged || notesChanged)) {
    const skuPatch: Partial<typeof schema.skus.$inferInsert> = { updatedAt: new Date() }
    if (statusFlagChanged) skuPatch.statusFlag = body.statusFlag ?? null
    if (pendingChanged) {
      skuPatch.statusPendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
    }
    if (notesChanged) skuPatch.statusNotes = String(body.notes ?? '').slice(0, 2000)
    if (statusFlagChanged) skuPatch.statusSetAt = new Date()

    // Ensure SKU row exists then update
    const skuRow = db.select().from(schema.skus).where(eq(schema.skus.sku, existing.sku)).get()
    if (skuRow) {
      db.update(schema.skus).set(skuPatch).where(eq(schema.skus.sku, existing.sku)).run()
    } else {
      db.insert(schema.skus).values({
        sku: existing.sku,
        description: existing.name,
        statusFlag: skuPatch.statusFlag,
        statusPendingUntil: skuPatch.statusPendingUntil,
        statusNotes: skuPatch.statusNotes ?? '',
        statusSetAt: skuPatch.statusSetAt,
      }).run()
    }

    // Cascade to other queued/partial items with the same SKU
    const cascadeUpdate: Partial<typeof schema.orderItems.$inferInsert> = {}
    if (statusFlagChanged) cascadeUpdate.statusFlag = body.statusFlag ?? null
    if (pendingChanged) cascadeUpdate.pendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
    if (notesChanged) cascadeUpdate.notes = String(body.notes ?? '').slice(0, 2000)

    const r = db.update(schema.orderItems)
      .set(cascadeUpdate)
      .where(eq(schema.orderItems.sku, existing.sku))
      .run()
    propagated = r.changes
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'order_item',
    entityId: id,
    action: 'order_item.notes.updated',
    payload: {
      orderNumber: existing.orderNumber,
      sku: existing.sku,
      changes: patch,
      previous: {
        statusFlag: existing.statusFlag,
        pendingUntil: existing.pendingUntil,
        notes: existing.notes,
      },
      propagatedToItems: propagated,
    },
  })

  return NextResponse.json({ ok: true, propagatedToItems: propagated })
}
