import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">Vendor-recorded payments awaiting your approval.</p>

      <div className="bg-white border rounded-lg overflow-hidden mb-8">
        <div className="px-4 py-2 bg-slate-50 border-b text-sm font-medium text-slate-600">Pending ({pending.length})</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Recorded</th>
              <th className="px-4 py-2 font-medium">Paid on</th>
              <th className="px-4 py-2 font-medium">Ref</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Nothing pending.</td></tr>
            )}
            {pending.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 text-slate-600">{p.recordedAt.toLocaleString()}</td>
                <td className="px-4 py-2 text-slate-600">{p.paidOn.toLocaleDateString()}</td>
                <td className="px-4 py-2">{p.refNote || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2 text-right font-medium">{fromCents(p.amountCents)}</td>
                <td className="px-4 py-2 text-right">
                  <ApprovePaymentButton paymentId={p.id} amountCents={p.amountCents} openInvoices={openInvoices} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b text-sm font-medium text-slate-600">Approved</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Approved</th>
              <th className="px-4 py-2 font-medium">Paid on</th>
              <th className="px-4 py-2 font-medium">Ref</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {approved.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No approved payments yet.</td></tr>
            )}
            {approved.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 text-slate-600">{p.approvedAt ? p.approvedAt.toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-slate-600">{p.paidOn.toLocaleDateString()}</td>
                <td className="px-4 py-2">{p.refNote || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2 text-right">{fromCents(p.amountCents)}</td>
                <td className="px-4 py-2"><Badge>approved</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
