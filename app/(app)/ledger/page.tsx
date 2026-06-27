import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { getLedger } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

export default async function LedgerPage() {
  const l = getLedger()
  const ob = db.select().from(schema.ledgerOpeningBalance).get()
  const invoices = db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).all()
  const payments = db.select().from(schema.payments).where(eq(schema.payments.status, 'approved')).orderBy(desc(schema.payments.paidOn)).all()

  type Row = { date: Date; label: string; debitCents: number; creditCents: number }
  const rows: Row[] = []
  if (ob) rows.push({ date: ob.asOf, label: 'Opening balance', debitCents: ob.amountCents, creditCents: 0 })
  for (const inv of invoices) rows.push({ date: inv.createdAt, label: `Invoice ${inv.id} (batch ${inv.batchId})`, debitCents: inv.totalCents, creditCents: 0 })
  for (const p of payments) rows.push({ date: p.paidOn, label: `Payment${p.refNote ? ' — ' + p.refNote : ''}`, debitCents: 0, creditCents: p.amountCents })
  rows.sort((a, b) => a.date.getTime() - b.date.getTime())

  let running = 0
  const display = rows.map(r => {
    running += r.debitCents - r.creditCents
    return { ...r, runningCents: running }
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Current balance: <span className="font-medium text-slate-900">{fromCents(l.currentBalanceCents)}</span>
        <span className="ml-3 text-slate-500">Invoiced {fromCents(l.invoicedCents)} · Paid {fromCents(l.paidCents)}</span>
      </p>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium text-right">Charge</th>
              <th className="px-4 py-2 font-medium text-right">Payment</th>
              <th className="px-4 py-2 font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No entries yet.</td></tr>
            )}
            {display.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2 text-slate-600">{r.date.toLocaleDateString()}</td>
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 text-right text-slate-700">{r.debitCents ? fromCents(r.debitCents) : ''}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{r.creditCents ? fromCents(r.creditCents) : ''}</td>
                <td className="px-4 py-2 text-right font-medium">{fromCents(r.runningCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
