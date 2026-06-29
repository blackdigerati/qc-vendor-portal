import { NextResponse } from 'next/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  const { id: batchId } = await params

  const batch = (await db.select().from(schema.batches).where(eq(schema.batches.id, batchId)))[0]
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (!batch.invoiceId) return NextResponse.json({ error: 'Batch has no invoice' }, { status: 409 })

  const invoiceId = batch.invoiceId

  // Block if any allocations already exist (payments touched this invoice)
  const allocCount = (await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.paymentAllocations)
    .where(eq(schema.paymentAllocations.invoiceId, invoiceId)))[0]?.c ?? 0
  if (allocCount > 0) {
    return NextResponse.json({
      error: 'Cannot delete — payments have already been allocated to this invoice. Cancel those first.',
    }, { status: 409 })
  }

  // 1) Clear FK on the batch
  await db.update(schema.batches).set({ status: 'shipped', invoiceId: null })
    .where(eq(schema.batches.id, batchId))
  // 2) Remove invoice lines
  await db.delete(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, invoiceId))
  // 3) Remove invoice
  await db.delete(schema.invoices).where(eq(schema.invoices.id, invoiceId))

  await writeAudit({
    actor: s.userId,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.deleted',
    payload: { batchId, reason: 'admin deleted via batch page' },
  })

  return NextResponse.json({ ok: true, deletedInvoiceId: invoiceId, batchReopened: batchId })
}
