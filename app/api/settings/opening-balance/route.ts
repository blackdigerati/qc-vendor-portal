import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const amount = toCents(body.amount)
  const asOf = body.as_of ? new Date(String(body.as_of)) : new Date()

  if (amount < 0) return NextResponse.json({ error: 'Amount cannot be negative' }, { status: 400 })

  const existing = db.select().from(schema.ledgerOpeningBalance).get()
  if (existing) {
    db.update(schema.ledgerOpeningBalance)
      .set({ amountCents: amount, asOf, setBy: s.userId, setAt: new Date() })
      .where(eq(schema.ledgerOpeningBalance.id, 1))
      .run()
  } else {
    db.insert(schema.ledgerOpeningBalance).values({ id: 1, amountCents: amount, asOf, setBy: s.userId }).run()
  }

  await writeAudit({ actor: s.userId, entityType: 'settings', entityId: 'opening_balance', action: 'opening_balance.set', payload: { amount, asOf: asOf.toISOString() } })
  return NextResponse.json({ ok: true })
}
