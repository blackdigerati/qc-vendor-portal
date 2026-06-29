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

// A payment counts on the ledger once the vendor has confirmed receipt.
// 'approved' is legacy (old approval flow) — treat as received for back-compat.
const RECEIVED_SQL = sql`${schema.payments.status} IN ('received', 'approved')`

export async function getLedger(): Promise<LedgerSnapshot> {
  const ob = (await db.select().from(schema.ledgerOpeningBalance))[0]
  const openingBalanceCents = ob?.amountCents ?? 0

  const invSum = (await db
    .select({ s: sql<number>`coalesce(sum(${schema.invoices.totalCents}), 0)` })
    .from(schema.invoices))[0]?.s ?? 0

  const paySum = (await db
    .select({ s: sql<number>`coalesce(sum(${schema.payments.amountCents}), 0)` })
    .from(schema.payments)
    .where(RECEIVED_SQL))[0]?.s ?? 0

  const allocSum = (await db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(RECEIVED_SQL))[0]?.s ?? 0

  const openInvoices = (await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.invoices)
    .where(ne(schema.invoices.status, 'paid')))[0]?.c ?? 0

  return {
    openingBalanceCents,
    invoicedCents: invSum,
    paidCents: paySum,
    unallocatedCreditCents: paySum - allocSum,
    currentBalanceCents: openingBalanceCents + invSum - paySum,
    openInvoices,
  }
}

/** Recompute invoice.status based on RECEIVED-payment allocations only. */
export async function recomputeInvoiceStatus(invoiceId: string) {
  const inv = (await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)))[0]
  if (!inv) return
  const allocated = (await db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(sql`${schema.paymentAllocations.invoiceId} = ${invoiceId} AND ${schema.payments.status} IN ('received', 'approved')`))[0]?.s ?? 0
  let status: 'open' | 'partial' | 'paid' = 'open'
  if (allocated >= inv.totalCents) status = 'paid'
  else if (allocated > 0) status = 'partial'
  await db.update(schema.invoices).set({ status }).where(eq(schema.invoices.id, invoiceId))
}

/** Open balance on an invoice, considering only RECEIVED payments. */
export async function invoiceOpenBalance(invoiceId: string): Promise<number> {
  const inv = (await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)))[0]
  if (!inv) return 0
  const allocated = (await db
    .select({ s: sql<number>`coalesce(sum(${schema.paymentAllocations.amountCents}), 0)` })
    .from(schema.paymentAllocations)
    .innerJoin(schema.payments, eq(schema.paymentAllocations.paymentId, schema.payments.id))
    .where(sql`${schema.paymentAllocations.invoiceId} = ${invoiceId} AND ${schema.payments.status} IN ('received', 'approved')`))[0]?.s ?? 0
  return Math.max(0, inv.totalCents - allocated)
}
