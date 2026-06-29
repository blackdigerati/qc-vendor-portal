import { desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { fromCents } from '@/lib/money'
import { MarkReceivedButton } from './mark-received-button'

export const dynamic = 'force-dynamic'

const RECEIVED = ['received', 'approved'] as const

export default async function PaymentsPage() {
  await requireSession()
  const payments = await db.select().from(schema.payments).orderBy(desc(schema.payments.paidOn))
  const allocs = await db.select().from(schema.paymentAllocations)
  const allocsByPayment = new Map<string, typeof allocs>()
  for (const a of allocs) {
    const list = allocsByPayment.get(a.paymentId) || []
    list.push(a)
    allocsByPayment.set(a.paymentId, list)
  }

  const pending = payments.filter(p => p.status === 'sent')
  const received = payments.filter(p => (RECEIVED as readonly string[]).includes(p.status))
  const other = payments.filter(p => !pending.includes(p) && !received.includes(p))

  const totalReceived = received.reduce((acc, p) => acc + p.amountCents, 0)
  const totalPending = pending.reduce((acc, p) => acc + p.amountCents, 0)

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          Received: <span className="font-semibold text-slate-900 tabular-nums">{fromCents(totalReceived)}</span>
          {totalPending > 0 && (
            <> · <span className="text-amber-700">Pending receipt: <span className="font-semibold tabular-nums">{fromCents(totalPending)}</span></span></>
          )}
        </p>
      </div>

      {pending.length > 0 && (
        <section className="bg-white border border-amber-300 rounded-md shadow-sm overflow-hidden">
          <header className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] uppercase tracking-wider font-semibold text-amber-900 flex items-center justify-between">
            <span>Sent — awaiting your confirmation</span>
            <span>{pending.length}</span>
          </header>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold w-28">Sent on</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Ref</th>
                <th className="px-3 py-2 text-left font-semibold">Will apply to</th>
                <th className="px-3 py-2 text-right font-semibold w-32"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => {
                const myAllocs = allocsByPayment.get(p.id) || []
                const allocSum = myAllocs.reduce((a, x) => a + x.amountCents, 0)
                const arrears = p.amountCents - allocSum
                return (
                  <tr key={p.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.paidOn.toLocaleDateString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(p.amountCents)}</td>
                    <td className="px-3 py-1.5">{p.refNote || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-slate-700">
                      <div className="space-y-0.5">
                        {myAllocs.map(a => (
                          <div key={a.id} className="text-[12px]">
                            <span className="font-mono text-slate-700">{a.invoiceId}</span>
                            <span className="text-slate-400 ml-2 tabular-nums">{fromCents(a.amountCents)}</span>
                          </div>
                        ))}
                        {arrears > 0 && (
                          <div className="text-[12px] text-emerald-700 font-medium">
                            Arrears / account credit
                            <span className="ml-2 tabular-nums">{fromCents(arrears)}</span>
                          </div>
                        )}
                        {myAllocs.length === 0 && arrears === 0 && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <MarkReceivedButton paymentId={p.id} amountCents={p.amountCents} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center justify-between">
          <span>Received</span>
          <span className="text-slate-500">{received.length}</span>
        </header>
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
            {received.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No payments received yet.</td></tr>
            )}
            {received.map(p => {
              const myAllocs = allocsByPayment.get(p.id) || []
              const allocSum = myAllocs.reduce((a, x) => a + x.amountCents, 0)
              const credit = p.amountCents - allocSum
              return (
                <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50 align-top">
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p.paidOn.toLocaleDateString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(p.amountCents)}</td>
                  <td className="px-3 py-1.5">{p.refNote || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-1.5 text-slate-700">
                    <div className="space-y-0.5">
                      {myAllocs.map(a => (
                        <div key={a.id} className="text-[12px]">
                          <span className="font-mono text-slate-700">{a.invoiceId}</span>
                          <span className="text-slate-400 ml-2 tabular-nums">{fromCents(a.amountCents)}</span>
                        </div>
                      ))}
                      {credit > 0 && (
                        <div className="text-[12px] text-emerald-700 font-medium">
                          Arrears / account credit
                          <span className="ml-2 tabular-nums">{fromCents(credit)}</span>
                        </div>
                      )}
                      {myAllocs.length === 0 && credit === 0 && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {credit > 0 ? <span className="text-emerald-700 font-medium">{fromCents(credit)}</span> : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
