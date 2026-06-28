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
  if ('statusFlag' in body) patch.statusFlag = body.statusFlag ?? null
  if ('pendingUntil' in body) {
    patch.pendingUntil = body.pendingUntil ? new Date(body.pendingUntil) : null
  }
  if ('notes' in body) patch.notes = String(body.notes ?? '').slice(0, 2000)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  db.update(schema.orderItems).set(patch).where(eq(schema.orderItems.id, id)).run()

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
    },
  })

  return NextResponse.json({ ok: true })
}
