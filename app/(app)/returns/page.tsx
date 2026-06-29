import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { LogReturnButton } from './log-return-button'
import { MarkReceivedButton } from './mark-received-button'

export const dynamic = 'force-dynamic'

export default async function ReturnsPage() {
  const logged = await db.select().from(schema.returns).where(eq(schema.returns.status, 'logged')).orderBy(desc(schema.returns.loggedAt))
  const received = await db.select().from(schema.returns).where(eq(schema.returns.status, 'received')).orderBy(desc(schema.returns.receivedAt))
  const creditSum = received.reduce((a, r) => a + r.creditCents, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Returns</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {logged.length} awaiting vendor receipt · {received.length} received{creditSum > 0 && <> · <span className="text-emerald-700 font-medium">{fromCents(creditSum)} credited</span></>}
          </p>
        </div>
        <LogReturnButton />
      </div>

      <section className="bg-white border border-amber-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] uppercase tracking-wider font-semibold text-amber-900 flex items-center justify-between">
          <span>Awaiting vendor receipt</span><span>{logged.length}</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Logged</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Reason / Notes</th>
              <th className="px-3 py-2 text-right font-semibold w-36"></th>
            </tr>
          </thead>
          <tbody>
            {logged.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No returns awaiting receipt.</td></tr>
            )}
            {logged.map(r => (
              <tr key={r.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{r.loggedAt.toLocaleDateString()}</td>
                <td className="px-3 py-1.5 font-mono font-semibold">#{r.orderNumber}</td>
                <td className="px-3 py-1.5">
                  <div className="font-medium text-slate-800">{r.reason || <span className="text-slate-400">—</span>}</div>
                  {r.notes && <div className="text-[12px] text-slate-600 italic">“{r.notes}”</div>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <MarkReceivedButton returnId={r.id} orderNumber={r.orderNumber} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center justify-between">
          <span>Received & credited</span><span className="text-slate-500">{received.length}</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Received</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Reason / Notes</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Credit</th>
            </tr>
          </thead>
          <tbody>
            {received.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No received returns yet.</td></tr>
            )}
            {received.map(r => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{r.receivedAt?.toLocaleDateString() ?? '—'}</td>
                <td className="px-3 py-1.5 font-mono font-semibold">#{r.orderNumber}</td>
                <td className="px-3 py-1.5">
                  <div className="font-medium text-slate-800">{r.reason || <span className="text-slate-400">—</span>}</div>
                  {r.notes && <div className="text-[12px] text-slate-600 italic">“{r.notes}”</div>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{fromCents(r.creditCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
