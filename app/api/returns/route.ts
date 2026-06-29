import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { writeAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const s = await requireSession()
  const body = await req.json().catch(() => ({}))
  const orderNumber = String(body.orderNumber || '').trim()
  const reason = String(body.reason || '').trim().slice(0, 500)
  const notes = String(body.notes || '').trim().slice(0, 2000)
  if (!orderNumber) return NextResponse.json({ error: 'Order # required' }, { status: 400 })

  const id = newId('rt')
  await db.insert(schema.returns).values({
    id,
    orderNumber,
    reason,
    notes,
    loggedBy: s.userId,
    status: 'logged',
  })

  await writeAudit({
    actor: s.userId,
    entityType: 'return',
    entityId: id,
    action: 'return.logged',
    payload: { orderNumber, reason },
  })

  return NextResponse.json({ ok: true, id })
}
