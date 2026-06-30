import Link from 'next/link'
import { db, schema } from '@/db/client'
import { MergeGroupButton, type MergeCandidate } from './merge-button'
import { MergeAllButton, type MergeAllGroup } from './merge-all-button'

export const dynamic = 'force-dynamic'

function normalizeAddress(o: typeof schema.orders.$inferSelect): string {
  return [o.address1, o.address2, o.city, o.state, o.zip, o.country]
    .map(s => (s || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')
    .replace(/\s+/g, ' ')
}

type Group = {
  email: string
  orders: (typeof schema.orders.$inferSelect)[]
  active: (typeof schema.orders.$inferSelect)[]
  merged: (typeof schema.orders.$inferSelect)[]
  state: 'pending' | 'merged'
  survivor?: typeof schema.orders.$inferSelect
  allAddrMatch: boolean
}

export default async function MergeReportPage() {
  const orders = await db.select().from(schema.orders)
  // Only orders that are still actively mergeable, or that have already been merged.
  // Shipped / cancelled (without a merge link) drop out entirely.
  const eligible = orders.filter(o => {
    if (o.mergedIntoOrderNumber) return true             // merged history
    return o.status === 'queued' || o.status === 'partial' // still active
  })

  const byEmail = new Map<string, typeof eligible>()
  for (const o of eligible) {
    const list = byEmail.get(o.email) || []
    list.push(o)
    byEmail.set(o.email, list)
  }

  const groups: Group[] = []
  for (const [email, list] of byEmail) {
    const active = list.filter(o => !o.mergedIntoOrderNumber)
    const merged = list.filter(o => !!o.mergedIntoOrderNumber)

    let state: 'pending' | 'merged'
    let survivor: typeof schema.orders.$inferSelect | undefined
    if (active.length > 1) {
      state = 'pending'
    } else if (active.length === 1 && merged.length > 0 && merged.every(m => m.mergedIntoOrderNumber === active[0].orderNumber)) {
      state = 'merged'
      survivor = active[0]
    } else {
      // 1 active alone with no merge history, or 0 active = nothing to merge anymore.
      continue
    }

    const baseAddr = list[0] ? normalizeAddress(list[0]) : ''
    const allAddrMatch = list.every(o => normalizeAddress(o) === baseAddr)

    groups.push({ email, orders: list, active, merged, state, survivor, allAddrMatch })
  }

  // Sort pending first
  groups.sort((a, b) => (a.state === 'pending' ? 0 : 1) - (b.state === 'pending' ? 0 : 1))

  const pendingMatchingGroups: MergeAllGroup[] = groups
    .filter(g => g.state === 'pending' && g.allAddrMatch)
    .map(g => {
      const sorted = [...g.active].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber))
      return {
        email: g.email,
        keepOrderNumber: sorted[0].orderNumber,
        mergeOrderNumbers: sorted.slice(1).map(o => o.orderNumber),
      }
    })

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Merge Candidates</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {groups.length === 0
              ? 'No duplicate emails right now.'
              : `${groups.length} email${groups.length === 1 ? '' : 's'} with multiple orders · ${groups.filter(g => g.state === 'pending').length} pending`}
          </p>
        </div>
        {pendingMatchingGroups.length > 0 && (
          <MergeAllButton groups={pendingMatchingGroups} />
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-md p-10 text-center text-slate-500 shadow-sm">
          Nothing to merge.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const baseAddr = normalizeAddress(g.orders[0])
            const candidates: MergeCandidate[] = g.active.map(o => ({
              orderNumber: o.orderNumber,
              customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
              shipTo: [o.address1, o.address2, o.city, o.state, o.zip].filter(Boolean).join(', '),
              addressMatches: normalizeAddress(o) === baseAddr,
            }))

            const allMatch = g.allAddrMatch
            const isMerged = g.state === 'merged'

            return (
              <div key={g.email} className={`bg-white border rounded-md shadow-sm overflow-hidden ${isMerged ? 'border-slate-300 opacity-90' : 'border-slate-300'}`}>
                <div className={`px-3 py-2 border-b text-[13px] flex items-center justify-between ${isMerged ? 'bg-slate-100 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <span className="font-semibold text-slate-900">{g.email}</span>
                    <span className={`font-medium text-[12px] ml-2 ${isMerged ? 'text-slate-600' : 'text-amber-800'}`}>
                      {g.orders.length} orders
                    </span>
                    {!allMatch && !isMerged && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 border border-amber-400">
                        Address mismatch
                      </span>
                    )}
                    {isMerged && g.survivor && (
                      <span className="ml-2 text-[12px] text-slate-600">
                        Survivor: <Link href={`#`} className="font-mono text-slate-900 hover:underline">#{g.survivor.orderNumber}</Link>
                      </span>
                    )}
                  </div>
                  {isMerged ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wider bg-slate-900 text-white">
                      ✓ Merged
                    </span>
                  ) : (
                    <MergeGroupButton email={g.email} candidates={candidates} />
                  )}
                </div>
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
                      <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
                      <th className="px-3 py-2 text-left font-semibold w-24">Address</th>
                      <th className="px-3 py-2 text-left font-semibold">Customer</th>
                      <th className="px-3 py-2 text-left font-semibold">Ship to</th>
                      <th className="px-3 py-2 text-left font-semibold w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.orders.map(o => {
                      const addrMatches = normalizeAddress(o) === baseAddr
                      const wasMerged = !!o.mergedIntoOrderNumber
                      return (
                        <tr key={o.orderNumber} className={`border-t border-slate-200 hover:bg-slate-50 ${o.urgent ? 'border-l-2 border-l-red-500' : ''} ${wasMerged ? 'bg-slate-50' : ''}`}>
                          <td className="px-3 py-1.5">
                            <span className={`font-mono font-semibold ${wasMerged ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                              #{o.orderNumber}
                            </span>
                            {o.urgent && !wasMerged && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">URG</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {addrMatches ? (
                              <span className="text-emerald-700 text-[12px] font-medium">✓ match</span>
                            ) : (
                              <span className="text-amber-700 text-[12px] font-medium">⚠ differs</span>
                            )}
                          </td>
                          <td className={`px-3 py-1.5 ${wasMerged ? 'text-slate-400' : 'text-slate-700'}`}>{[o.firstName, o.lastName].filter(Boolean).join(' ')}</td>
                          <td className={`px-3 py-1.5 ${wasMerged ? 'text-slate-400' : 'text-slate-600'}`}>{[o.address1, o.city, o.state, o.zip].filter(Boolean).join(', ')}</td>
                          <td className="px-3 py-1.5 text-[12px]">
                            {wasMerged ? (
                              <span className="text-slate-500">merged → <span className="font-mono">#{o.mergedIntoOrderNumber}</span></span>
                            ) : (
                              <span className="text-slate-700">{o.status}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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
