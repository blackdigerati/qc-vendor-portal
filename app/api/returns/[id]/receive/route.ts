import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const creditCents = toCents(body.credit)
  const notes = String(body.notes || '').trim().slice(0, 2000)

  const r = (await db.select().from(schema.returns).where(eq(schema.returns.id, id)))[0]
  if (!r) return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  if (r.status !== 'logged') return NextResponse.json({ error: `Already ${r.status}` }, { status: 409 })
  if (creditCents <= 0) return NextResponse.json({ error: 'Credit amount must be > 0' }, { status: 400 })

  const now = new Date()
  await db.update(schema.returns).set({
    status: 'received',
    receivedAt: now,
    receivedBy: s.userId,
    creditCents,
    notes: notes || r.notes,
  }).where(eq(schema.returns.id, id))

  await writeAudit({
    actor: s.userId,
    entityType: 'return',
    entityId: id,
    action: 'return.received',
    payload: { orderNumber: r.orderNumber, creditCents },
  })

  return NextResponse.json({ ok: true, creditCents })
}
