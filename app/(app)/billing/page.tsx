import { desc } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { getLedger, invoiceOpenBalance } from '@/lib/ledger'
import { RecordPaymentButton } from './record-payment'

export const dynamic = 'force-dynamic'

function statusPill(s: string) {
  const map: Record<string, string> = {
    open: 'bg-amber-100 text-amber-900 border border-amber-300',
    partial: 'bg-blue-100 text-blue-900 border border-blue-300',
    paid: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${map[s] || 'bg-slate-200 text-slate-800'}`}>{s}</span>
}

export default async function BillingPage() {
  const ledger = getLedger()
  const invoices = db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).all()
  const rows = invoices.map(inv => ({ ...inv, openCents: invoiceOpenBalance(inv.id) }))
  const openInvoiceOptions = rows.filter(r => r.openCents > 0).map(r => ({ id: r.id, openCents: r.openCents }))

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            Outstanding: <span className="font-semibold text-slate-900 tabular-nums">{fromCents(ledger.currentBalanceCents)}</span>
            {ledger.unallocatedCreditCents > 0 && (
              <span className="ml-3 text-emerald-700">Unallocated credit: <span className="font-semibold tabular-nums">{fromCents(ledger.unallocatedCreditCents)}</span></span>
            )}
          </p>
        </div>
        <RecordPaymentButton invoices={openInvoiceOptions} />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-3">
        <Tile label="Invoiced (lifetime)" value={fromCents(ledger.invoicedCents)} />
        <Tile label="Paid (approved)" value={fromCents(ledger.paidCents)} tone="emerald" />
        <Tile label="Open invoices" value={String(ledger.openInvoices)} />
        <Tile label="Current balance" value={fromCents(ledger.currentBalanceCents)} tone="slate-dark" />
      </div>

      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-36">Invoice</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Batch</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Created</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Status</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No invoices yet.</td></tr>
            )}
            {rows.map(inv => (
              <tr key={inv.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono font-semibold">{inv.id}</td>
                <td className="px-3 py-1.5 text-slate-600 font-mono">{inv.batchId}</td>
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-1.5">{statusPill(inv.status)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fromCents(inv.totalCents)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(inv.openCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'slate-dark' }) {
  const valTone =
    tone === 'emerald' ? 'text-emerald-700'
    : tone === 'slate-dark' ? 'text-slate-900'
    : 'text-slate-800'
  return (
    <div className="bg-white border border-slate-300 rounded-md px-3 py-2 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${valTone}`}>{value}</div>
    </div>
  )
}
