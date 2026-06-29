import Link from 'next/link'
import { desc, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { getLedger } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

type Allocation = { invoiceId: string; amountCents: number }

type Row =
  | { kind: 'opening'; date: Date; debitCents: number; creditCents: number }
  | { kind: 'invoice'; date: Date; debitCents: number; creditCents: number; invoiceId: string; batchId: string }
  | { kind: 'payment'; date: Date; debitCents: number; creditCents: number; paymentId: string; refNote: string; allocations: Allocation[]; creditRemainCents: number }

export default async function LedgerPage() {
  const l = getLedger()
  const ob = db.select().from(schema.ledgerOpeningBalance).get()
  const invoices = db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).all()
  const payments = db
    .select()
    .from(schema.payments)
    .where(sql`${schema.payments.status} IN ('received', 'approved')`)
    .orderBy(desc(schema.payments.paidOn))
    .all()
  const allocs = db.select().from(schema.paymentAllocations).all()
  const allocsByPayment = new Map<string, Allocation[]>()
  for (const a of allocs) {
    const list = allocsByPayment.get(a.paymentId) || []
    list.push({ invoiceId: a.invoiceId, amountCents: a.amountCents })
    allocsByPayment.set(a.paymentId, list)
  }

  const rows: Row[] = []
  if (ob) rows.push({ kind: 'opening', date: ob.asOf, debitCents: ob.amountCents, creditCents: 0 })
  for (const inv of invoices) {
    rows.push({ kind: 'invoice', date: inv.createdAt, debitCents: inv.totalCents, creditCents: 0, invoiceId: inv.id, batchId: inv.batchId })
  }
  for (const p of payments) {
    const myAllocs = allocsByPayment.get(p.id) || []
    const allocSum = myAllocs.reduce((acc, a) => acc + a.amountCents, 0)
    rows.push({
      kind: 'payment',
      date: p.paidOn,
      debitCents: 0,
      creditCents: p.amountCents,
      paymentId: p.id,
      refNote: p.refNote,
      allocations: myAllocs,
      creditRemainCents: p.amountCents - allocSum,
    })
  }
  rows.sort((a, b) => a.date.getTime() - b.date.getTime())

  let running = 0
  const display = rows.map(r => {
    running += r.debitCents - r.creditCents
    return { ...r, runningCents: running }
  })

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ledger</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          Current balance: <span className="font-semibold text-slate-900 tabular-nums">{fromCents(l.currentBalanceCents)}</span>
          <span className="ml-3 text-slate-500">Invoiced <span className="font-medium tabular-nums">{fromCents(l.invoicedCents)}</span> · Paid <span className="font-medium tabular-nums">{fromCents(l.paidCents)}</span></span>
          {l.unallocatedCreditCents > 0 && (
            <span className="ml-3 text-emerald-700">Unallocated credit: <span className="font-semibold tabular-nums">{fromCents(l.unallocatedCreditCents)}</span></span>
          )}
        </p>
      </div>
      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Charge</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Payment</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Balance</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No entries yet.</td></tr>
            )}
            {display.map((r, i) => (
              <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 align-top">
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{r.date.toLocaleDateString()}</td>
                <td className="px-3 py-1.5">
                  {r.kind === 'opening' && <span>Opening balance</span>}
                  {r.kind === 'invoice' && (
                    <span>
                      Invoice{' '}
                      <Link href={`/invoices/${r.invoiceId}`} className="font-mono font-semibold text-slate-900 hover:text-emerald-700 hover:underline">
                        {r.invoiceId}
                      </Link>{' '}
                      <span className="text-slate-500">
                        (batch{' '}
                        <Link href={`/batches/${r.batchId}`} className="font-mono hover:text-emerald-700 hover:underline">{r.batchId}</Link>
                        )
                      </span>
                    </span>
                  )}
                  {r.kind === 'payment' && (
                    <div className="space-y-0.5">
                      <div>Payment{r.refNote ? <span className="text-slate-600"> — {r.refNote}</span> : null}</div>
                      {r.allocations.length === 0 && r.creditRemainCents === 0 && (
                        <div className="text-[11px] text-slate-400">— no allocation —</div>
                      )}
                      {r.allocations.map((a, ai) => (
                        <div key={ai} className="text-[11px] text-slate-600 pl-3">
                          → applied to{' '}
                          <Link href={`/invoices/${a.invoiceId}`} className="font-mono text-slate-700 hover:text-emerald-700 hover:underline">
                            {a.invoiceId}
                          </Link>{' '}
                          <span className="tabular-nums text-slate-500">{fromCents(a.amountCents)}</span>
                        </div>
                      ))}
                      {r.creditRemainCents > 0 && (
                        <div className="text-[11px] text-emerald-700 pl-3">
                          → account credit (arrears){' '}
                          <span className="tabular-nums font-medium">{fromCents(r.creditRemainCents)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">{r.debitCents ? fromCents(r.debitCents) : ''}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 font-medium">{r.creditCents ? fromCents(r.creditCents) : ''}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(r.runningCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
