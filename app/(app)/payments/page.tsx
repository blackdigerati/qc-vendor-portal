import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { fromCents } from '@/lib/money'
import { invoiceOpenBalance } from '@/lib/ledger'
import { ApprovePaymentButton } from './approve-button'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  await requireAdmin()
  const pending = db.select().from(schema.payments).where(eq(schema.payments.status, 'vendor_recorded')).orderBy(desc(schema.payments.recordedAt)).all()
  const approved = db.select().from(schema.payments).where(eq(schema.payments.status, 'approved')).orderBy(desc(schema.payments.approvedAt)).all()
  const invoices = db.select().from(schema.invoices).all()
  const openInvoices = invoices.map(i => ({ id: i.id, openCents: invoiceOpenBalance(i.id) })).filter(i => i.openCents > 0)

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">Vendor-recorded payments awaiting approval.</p>
      </div>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] uppercase tracking-wider font-semibold text-amber-900 flex items-center justify-between">
          <span>Pending approval</span>
          <span className="text-amber-700">{pending.length}</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-44">Recorded</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Paid on</th>
              <th className="px-3 py-2 text-left font-semibold">Ref</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Amount</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nothing pending.</td></tr>
            )}
            {pending.map(p => (
              <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.recordedAt.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.paidOn.toLocaleDateString()}</td>
                <td className="px-3 py-1.5">{p.refNote || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fromCents(p.amountCents)}</td>
                <td className="px-3 py-1.5 text-right">
                  <ApprovePaymentButton paymentId={p.id} amountCents={p.amountCents} openInvoices={openInvoices} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center justify-between">
          <span>Approved</span>
          <span className="text-slate-500">{approved.length}</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-32">Approved</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Paid on</th>
              <th className="px-3 py-2 text-left font-semibold">Ref</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {approved.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No approved payments yet.</td></tr>
            )}
            {approved.map(p => (
              <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.approvedAt ? p.approvedAt.toLocaleDateString() : '—'}</td>
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.paidOn.toLocaleDateString()}</td>
                <td className="px-3 py-1.5">{p.refNote || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fromCents(p.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
