import { eq, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'

export type LedgerSnapshot = {
  openingBalanceCents: number
  invoicedCents: number
  paidCents: number
  unallocatedCreditCents: number
  currentBalanceCents: number
  openInvoices: number
}

export function getLedger(): LedgerSnapshot {
  const ob = db.select().from(schema.ledgerOpeningBalance).get()
  const openingBalanceCents = ob?.amountCents ?? 0

  const invSum = db
    .select({ s: sql<number>`coalesce(sum(${schema.invoices.totalCents}), 0)` })
    .from(schema.invoices)
    .get()?.s ?? 0

  const paySum = db
    .select({ s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.status, 'approved'))
    .get()?.s ?? 0

  const allocSum = db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(eq(schema.payments.status, 'approved'))
    .get()?.s ?? 0

  const openInvoices = db
    .select({ c: sql<number>`count(*)` })
    .from(schema.invoices)
    .where(ne(schema.invoices.status, 'paid'))
    .get()?.c ?? 0

  return {
    openingBalanceCents,
    invoicedCents: invSum,
    paidCents: paySum,
    unallocatedCreditCents: paySum - allocSum,
    currentBalanceCents: openingBalanceCents + invSum - paySum,
    openInvoices,
  }
}

/** Recompute invoice.status based on allocated payments. */
export function recomputeInvoiceStatus(invoiceId: string) {
  const inv = db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).get()
  if (!inv) return
  const allocated = db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(sql`${schema.paymentAllocations.invoiceId} = ${invoiceId} AND ${schema.payments.status} = 'approved'`)
    .get()?.s ?? 0
  let status: 'open' | 'partial' | 'paid' = 'open'
  if (allocated >= inv.totalCents) status = 'paid'
  else if (allocated > 0) status = 'partial'
  db.update(schema.invoices).set({ status }).where(eq(schema.invoices.id, invoiceId)).run()
}

export function invoiceOpenBalance(invoiceId: string): number {
  const inv = db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).get()
  if (!inv) return 0
  const allocated = db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(sql`${schema.paymentAllocations.invoiceId} = ${invoiceId} AND ${schema.payments.status} = 'approved'`)
    .get()?.s ?? 0
  return Math.max(0, inv.totalCents - allocated)
}
