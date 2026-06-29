import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { writeAudit } from '@/lib/audit'

type Row = { email: string; eventType: 'new_orders' | 'new_invoice' }

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const recipients = (Array.isArray(body.recipients) ? body.recipients : []) as Row[]
  const clean = recipients
    .map(r => ({ email: String(r.email || '').trim().toLowerCase(), eventType: r.eventType }))
    .filter(r => r.email && (r.eventType === 'new_orders' || r.eventType === 'new_invoice'))

  await db.delete(schema.alertRecipients)
  for (const r of clean) {
    await db.insert(schema.alertRecipients).values({ id: newId('ar'), email: r.email, eventType: r.eventType })
  }

  await writeAudit({ actor: s.userId, entityType: 'settings', entityId: 'alerts', action: 'alerts.updated', payload: { count: clean.length } })
  return NextResponse.json({ ok: true, count: clean.length })
}
