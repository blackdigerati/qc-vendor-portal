import { desc } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { Badge } from '@/components/ui/badge'
import { fromCents } from '@/lib/money'
import { getLedger, invoiceOpenBalance } from '@/lib/ledger'
import { RecordPaymentButton } from './record-payment'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const ledger = getLedger()
  const invoices = db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).all()
  const rows = invoices.map(inv => ({ ...inv, openCents: invoiceOpenBalance(inv.id) }))
  const openInvoiceOptions = rows.filter(r => r.openCents > 0).map(r => ({ id: r.id, openCents: r.openCents }))

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Outstanding: <span className="font-medium text-slate-900">{fromCents(ledger.currentBalanceCents)}</span>
            {ledger.unallocatedCreditCents > 0 && (
              <span className="ml-3 text-emerald-600">Unallocated credit: {fromCents(ledger.unallocatedCreditCents)}</span>
            )}
          </p>
        </div>
        <RecordPaymentButton invoices={openInvoiceOptions} />
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Invoice</th>
              <th className="px-4 py-2 font-medium">Batch</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No invoices yet.</td></tr>
            )}
            {rows.map(inv => (
              <tr key={inv.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{inv.id}</td>
                <td className="px-4 py-3 text-slate-600">{inv.batchId}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3"><Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>{inv.status}</Badge></td>
                <td className="px-4 py-3 text-right">{fromCents(inv.totalCents)}</td>
                <td className="px-4 py-3 text-right font-medium">{fromCents(inv.openCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
