import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { toCents } from '@/lib/money'
import { invoiceOpenBalance, recomputeInvoiceStatus } from '@/lib/ledger'
import { writeAudit } from '@/lib/audit'

// Body: { allocations: [{ invoice_id, amount }] }  — admin decides the split
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const incoming = Array.isArray(body.allocations) ? body.allocations : []

  const payment = db.select().from(schema.payments).where(eq(schema.payments.id, id)).get()
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status !== 'vendor_recorded') return NextResponse.json({ error: `Already ${payment.status}` }, { status: 409 })

  let totalAlloc = 0
  const cleanAllocs: { invoiceId: string; amountCents: number }[] = []
  for (const a of incoming) {
    const amt = toCents(a.amount)
    if (amt <= 0 || !a.invoice_id) continue
    const open = invoiceOpenBalance(String(a.invoice_id))
    if (open <= 0) continue
    const useAmt = Math.min(amt, open)
    cleanAllocs.push({ invoiceId: String(a.invoice_id), amountCents: useAmt })
    totalAlloc += useAmt
  }
  if (totalAlloc > payment.amountCents) {
    return NextResponse.json({ error: 'Allocations exceed payment amount' }, { status: 400 })
  }

  for (const a of cleanAllocs) {
    db.insert(schema.paymentAllocations).values({
      id: newId('pa'),
      paymentId: id,
      invoiceId: a.invoiceId,
      amountCents: a.amountCents,
    }).run()
  }
  db.update(schema.payments)
    .set({ status: 'approved', approvedBy: s.userId, approvedAt: new Date() })
    .where(eq(schema.payments.id, id))
    .run()

  for (const a of cleanAllocs) recomputeInvoiceStatus(a.invoiceId)

  await writeAudit({
    actor: s.userId,
    entityType: 'payment',
    entityId: id,
    action: 'payment.approved',
    payload: { allocations: cleanAllocs, totalAllocated: totalAlloc, unallocatedCredit: payment.amountCents - totalAlloc },
  })

  return NextResponse.json({ ok: true, allocated: totalAlloc, unallocatedCredit: payment.amountCents - totalAlloc })
}
