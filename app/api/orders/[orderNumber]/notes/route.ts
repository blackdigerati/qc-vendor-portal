import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const s = await requireSession()
  const { orderNumber } = await params
  const body = await req.json().catch(() => ({}))
  const notes = String(body.notes ?? '').slice(0, 2000)

  const existing = db.select().from(schema.orders).where(eq(schema.orders.orderNumber, orderNumber)).get()
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (existing.notes === notes) return NextResponse.json({ ok: true, unchanged: true })

  db.update(schema.orders).set({ notes }).where(eq(schema.orders.orderNumber, orderNumber)).run()

  await writeAudit({
    actor: s.userId,
    entityType: 'order',
    entityId: orderNumber,
    action: 'order.notes.updated',
    payload: { old: existing.notes, new: notes },
  })

  return NextResponse.json({ ok: true })
}
