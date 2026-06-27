import { inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'

export const dynamic = 'force-dynamic'

export default async function MergeReportPage() {
  const orders = db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, ['queued', 'partial', 'batched']))
    .all()

  const groups = new Map<string, typeof orders>()
  for (const o of orders) {
    const list = groups.get(o.email) || []
    list.push(o)
    groups.set(o.email, list)
  }
  const dupes = [...groups.entries()].filter(([, list]) => list.length > 1)

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Merge Candidates</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          {dupes.length === 0 ? 'No duplicate emails right now.' : `${dupes.length} email${dupes.length === 1 ? '' : 's'} with multiple open orders.`}
        </p>
      </div>
      {dupes.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-md p-10 text-center text-slate-500 shadow-sm">
          Nothing to merge.
        </div>
      ) : (
        <div className="space-y-3">
          {dupes.map(([email, list]) => (
            <div key={email} className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
              <div className="px-3 py-1.5 border-b border-slate-200 bg-amber-50 text-[13px] flex items-center justify-between">
                <span><span className="font-semibold text-slate-900">{email}</span></span>
                <span className="text-amber-800 font-medium text-[12px]">{list.length} orders</span>
              </div>
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
                    <th className="px-3 py-2 text-left font-semibold">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold">Ship to</th>
                    <th className="px-3 py-2 text-left font-semibold w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(o => (
                    <tr key={o.orderNumber} className={`border-t border-slate-200 hover:bg-slate-50 ${o.urgent ? 'border-l-2 border-l-red-500' : ''}`}>
                      <td className="px-3 py-1.5">
                        <span className="font-mono font-semibold">#{o.orderNumber}</span>
                        {o.urgent && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">URG</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">{[o.firstName, o.lastName].filter(Boolean).join(' ')}</td>
                      <td className="px-3 py-1.5 text-slate-600">{[o.address1, o.city, o.state, o.zip].filter(Boolean).join(', ')}</td>
                      <td className="px-3 py-1.5 text-slate-700 text-[12px]">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
