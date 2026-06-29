import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

type Body = {
  statusFlag?: 'out_of_stock' | 'backordered' | 'discontinued' | 'other' | null
  pendingUntil?: string | null
  notes?: string
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sku: string }> }) {
  const s = await requireSession()
  const { sku } = await params
  const body = (await req.json().catch(() => ({}))) as Body

  const skuRow = db.select().from(schema.skus).where(eq(schema.skus.sku, sku)).get()
  if (!skuRow) return NextResponse.json({ error: 'SKU not found' }, { status: 404 })

  const skuPatch: Partial<typeof schema.skus.$inferInsert> = { updatedAt: new Date() }
  if ('statusFlag' in body) {
    skuPatch.statusFlag = body.statusFlag ?? null
    skuPatch.statusSetAt = new Date()
  }
  if ('pendingUntil' in body) {
    skuPatch.statusPendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
  }
  if ('notes' in body) skuPatch.statusNotes = String(body.notes ?? '').slice(0, 2000)

  db.update(schema.skus).set(skuPatch).where(eq(schema.skus.sku, sku)).run()

  // Cascade to every order_items row sharing the SKU
  const cascadeUpdate: Partial<typeof schema.orderItems.$inferInsert> = {}
  if ('statusFlag' in body) cascadeUpdate.statusFlag = body.statusFlag ?? null
  if ('pendingUntil' in body) cascadeUpdate.pendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
  if ('notes' in body) cascadeUpdate.notes = String(body.notes ?? '').slice(0, 2000)

  const r = db.update(schema.orderItems)
    .set(cascadeUpdate)
    .where(eq(schema.orderItems.sku, sku))
    .run()

  await writeAudit({
    actor: s.userId,
    entityType: 'sku',
    entityId: sku,
    action: 'sku.status.updated',
    payload: { changes: skuPatch, cascadedToItems: r.changes, previous: { statusFlag: skuRow.statusFlag } },
  })

  return NextResponse.json({ ok: true, cascadedToItems: r.changes })
}
