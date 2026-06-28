import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { fromCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  await requireSession()
  const payments = db.select().from(schema.payments).orderBy(desc(schema.payments.paidOn)).all()
  const allocs = db.select().from(schema.paymentAllocations).all()
  const allocsByPayment = new Map<string, typeof allocs>()
  for (const a of allocs) {
    const list = allocsByPayment.get(a.paymentId) || []
    list.push(a)
    allocsByPayment.set(a.paymentId, list)
  }

  const totalReceived = payments.reduce((acc, p) => acc + p.amountCents, 0)
  const totalAllocated = allocs.reduce((acc, a) => acc + a.amountCents, 0)
  const unallocated = totalReceived - totalAllocated

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          History of recorded payments. Total received: <span className="font-semibold text-slate-900 tabular-nums">{fromCents(totalReceived)}</span>
          {unallocated > 0 && (
            <> · Unallocated credit: <span className="font-semibold text-emerald-700 tabular-nums">{fromCents(unallocated)}</span></>
          )}
        </p>
      </div>

      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Paid on</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Amount</th>
              <th className="px-3 py-2 text-left font-semibold">Ref</th>
              <th className="px-3 py-2 text-left font-semibold">Applied to</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Credit</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No payments recorded yet.</td></tr>
            )}
            {payments.map(p => {
              const myAllocs = allocsByPayment.get(p.id) || []
              const allocSum = myAllocs.reduce((a, x) => a + x.amountCents, 0)
              const credit = p.amountCents - allocSum
              return (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50 align-top">
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.paidOn.toLocaleDateString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(p.amountCents)}</td>
                  <td className="px-3 py-1.5">{p.refNote || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-1.5 text-slate-700">
                    {myAllocs.length === 0 ? (
                      <span className="text-slate-400">— (held as credit)</span>
                    ) : (
                      <div className="space-y-0.5">
                        {myAllocs.map(a => (
                          <div key={a.id} className="text-[12px]">
                            <span className="font-mono text-slate-700">{a.invoiceId}</span>
                            <span className="text-slate-400 ml-2 tabular-nums">{fromCents(a.amountCents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {credit > 0 ? <span className="text-emerald-700 font-medium">{fromCents(credit)}</span> : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
