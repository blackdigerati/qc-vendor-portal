import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { recomputeInvoiceStatus } from '@/lib/ledger'
import { writeAudit } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id } = await params

  const p = (await db.select().from(schema.payments).where(eq(schema.payments.id, id)))[0]
  if (!p) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (p.status !== 'sent') return NextResponse.json({ error: `Already ${p.status}` }, { status: 409 })

  const now = new Date()
  await db.update(schema.payments).set({
    status: 'received',
    approvedBy: s.userId,
    approvedAt: now,
  }).where(eq(schema.payments.id, id))

  // Apply allocations now (they were written at send time but didn't count)
  const allocs = await db.select().from(schema.paymentAllocations)
    .where(eq(schema.paymentAllocations.paymentId, id))
  for (const a of allocs) await recomputeInvoiceStatus(a.invoiceId)

  await writeAudit({
    actor: s.userId,
    entityType: 'payment',
    entityId: id,
    action: 'payment.received',
    payload: {
      amount: p.amountCents,
      allocations: allocs.map(a => ({ invoiceId: a.invoiceId, amountCents: a.amountCents })),
    },
  })

  return NextResponse.json({
    ok: true,
    id,
    receivedAt: now.toISOString(),
    invoicesUpdated: allocs.length,
  })
}
