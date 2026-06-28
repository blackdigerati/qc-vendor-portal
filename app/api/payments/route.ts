import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'
import { invoiceOpenBalance, recomputeInvoiceStatus } from '@/lib/ledger'

type AllocationInput = { invoice_id: string; amount: string | number }

export async function POST(req: Request) {
  const s = await requireSession()
  const body = await req.json().catch(() => ({}))
  const amount = toCents(body.amount)
  const paidOn = body.paid_on ? new Date(String(body.paid_on)) : new Date()
  const ref = String(body.ref || '').trim()
  const allocations = Array.isArray(body.allocations) ? (body.allocations as AllocationInput[]) : []

  if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })

  // Validate + clamp allocations against current open balances
  let totalAlloc = 0
  const cleanAllocs: { invoiceId: string; amountCents: number }[] = []
  for (const a of allocations) {
    const amt = toCents(a.amount)
    if (amt <= 0 || !a.invoice_id) continue
    const open = invoiceOpenBalance(String(a.invoice_id))
    if (open <= 0) continue
    const useAmt = Math.min(amt, open)
    cleanAllocs.push({ invoiceId: String(a.invoice_id), amountCents: useAmt })
    totalAlloc += useAmt
  }
  if (totalAlloc > amount) {
    return NextResponse.json({ error: 'Allocations exceed payment amount' }, { status: 400 })
  }

  const id = newId('pay')
  const now = new Date()

  db.insert(schema.payments).values({
    id,
    amountCents: amount,
    paidOn,
    refNote: ref,
    recordedBy: s.userId,
    status: 'approved',
    approvedBy: s.userId,
    approvedAt: now,
  }).run()

  for (const a of cleanAllocs) {
    db.insert(schema.paymentAllocations).values({
      id: newId('pa'),
      paymentId: id,
      invoiceId: a.invoiceId,
      amountCents: a.amountCents,
    }).run()
    recomputeInvoiceStatus(a.invoiceId)
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'payment',
    entityId: id,
    action: 'payment.recorded',
    payload: {
      amount, paidOn, ref,
      allocations: cleanAllocs,
      totalAllocated: totalAlloc,
      unallocatedCredit: amount - totalAlloc,
    },
  })

  return NextResponse.json({
    ok: true,
    id,
    allocated: totalAlloc,
    unallocatedCredit: amount - totalAlloc,
  })
}
