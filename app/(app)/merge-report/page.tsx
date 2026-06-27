import { inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { Badge } from '@/components/ui/badge'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Merge candidates</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Orders grouped by customer email — these may belong together in one shipment.
      </p>
      {dupes.length === 0 ? (
        <div className="bg-white border rounded-lg p-10 text-center text-slate-500">
          No merge candidates right now.
        </div>
      ) : (
        <div className="space-y-4">
          {dupes.map(([email, list]) => (
            <div key={email} className="bg-white border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50 text-sm">
                <span className="font-medium">{email}</span>
                <span className="text-slate-500 ml-2">({list.length} orders)</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Order</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Ship to</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(o => (
                    <tr key={o.orderNumber} className="border-t">
                      <td className="px-4 py-2 font-medium">
                        #{o.orderNumber}
                        {o.urgent && <Badge variant="destructive" className="ml-2">URGENT</Badge>}
                      </td>
                      <td className="px-4 py-2">{[o.firstName, o.lastName].filter(Boolean).join(' ')}</td>
                      <td className="px-4 py-2 text-slate-600">{[o.address1, o.city, o.state, o.zip].filter(Boolean).join(', ')}</td>
                      <td className="px-4 py-2 text-slate-600">{o.status}</td>
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
