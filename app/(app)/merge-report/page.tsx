import { inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { MergeGroupButton, type MergeCandidate } from './merge-button'

export const dynamic = 'force-dynamic'

function normalizeAddress(o: typeof schema.orders.$inferSelect): string {
  return [o.address1, o.address2, o.city, o.state, o.zip, o.country]
    .map(s => (s || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
    .replace(/\s+/g, ' ')
}

export default async function MergeReportPage() {
  const orders = db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, ['queued', 'partial']))
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
          {dupes.map(([email, list]) => {
            const baseAddr = normalizeAddress(list[0])
            const candidates: MergeCandidate[] = list.map(o => ({
              orderNumber: o.orderNumber,
              customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
              shipTo: [o.address1, o.address2, o.city, o.state, o.zip].filter(Boolean).join(', '),
              addressMatches: normalizeAddress(o) === baseAddr,
            }))
            const allMatch = candidates.every(c => c.addressMatches)
            return (
              <div key={email} className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-amber-50 text-[13px] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{email}</span>
                    <span className="text-amber-800 font-medium text-[12px] ml-2">{list.length} orders</span>
                    {!allMatch && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 border border-amber-400">
                        Address mismatch
                      </span>
                    )}
                  </div>
                  <MergeGroupButton email={email} candidates={candidates} />
                </div>
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
                      <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
                      <th className="px-3 py-2 text-left font-semibold w-24">Address</th>
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
                        <td className="px-3 py-1.5">
                          {normalizeAddress(o) === baseAddr ? (
                            <span className="text-emerald-700 text-[12px] font-medium">✓ match</span>
                          ) : (
                            <span className="text-amber-700 text-[12px] font-medium">⚠ differs</span>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
