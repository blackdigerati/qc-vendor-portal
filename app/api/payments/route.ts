import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const s = await requireSession()
  const body = await req.json().catch(() => ({}))
  const amount = toCents(body.amount)
  const paidOn = body.paid_on ? new Date(String(body.paid_on)) : new Date()
  const ref = String(body.ref || '').trim()
  const invoiceId = body.invoice_id ? String(body.invoice_id) : null

  if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })
  if (invoiceId) {
    const inv = db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).get()
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const id = newId('pay')
  db.insert(schema.payments).values({
    id,
    amountCents: amount,
    paidOn,
    refNote: ref,
    recordedBy: s.userId,
    status: 'vendor_recorded',
  }).run()

  // Stash intended invoice link as an unapproved allocation marker — we'll use payload metadata in audit
  await writeAudit({
    actor: s.userId,
    entityType: 'payment',
    entityId: id,
    action: 'payment.recorded',
    payload: { amount, paidOn, ref, intendedInvoice: invoiceId },
  })

  return NextResponse.json({ ok: true, id })
}
