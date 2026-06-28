import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'
import { eq } from 'drizzle-orm'
import { invoiceOpenBalance, recomputeInvoiceStatus } from '@/lib/ledger'

type AllocationInput = { invoice_id: string; amount: string | number }

export async function POST(req: Request) {
  const s = await requireSession()
  const body = await req.json().catch(() => ({}))
  const amount = toCents(body.amount)
  const paidOn = body.paid_on ? new Date(String(body.paid_on)) : new Date()
  const ref = String(body.ref || '').trim()
  const invoiceId = body.invoice_id ? String(body.invoice_id) : null
  const allocations = Array.isArray(body.allocations) ? (body.allocations as AllocationInput[]) : null

  if (amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 })
  if (invoiceId) {
    const inv = db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).get()
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const id = newId('pay')

  // Admin + explicit allocations → one-shot: record + auto-approve + apply
  const isAdminOneShot = s.role === 'admin' && allocations && allocations.length > 0
  if (isAdminOneShot) {
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

    db.insert(schema.payments).values({
      id,
      amountCents: amount,
      paidOn,
      refNote: ref,
      recordedBy: s.userId,
      status: 'approved',
      approvedBy: s.userId,
      approvedAt: new Date(),
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
      action: 'payment.recorded_and_approved',
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
      autoApproved: true,
      allocated: totalAlloc,
      unallocatedCredit: amount - totalAlloc,
    })
  }

  // Vendor flow (or admin without allocations) — record pending approval
  db.insert(schema.payments).values({
    id,
    amountCents: amount,
    paidOn,
    refNote: ref,
    recordedBy: s.userId,
    status: 'vendor_recorded',
  }).run()

  await writeAudit({
    actor: s.userId,
    entityType: 'payment',
    entityId: id,
    action: 'payment.recorded',
    payload: { amount, paidOn, ref, intendedInvoice: invoiceId },
  })

  return NextResponse.json({ ok: true, id, autoApproved: false })
}
