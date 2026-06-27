import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { Badge } from '@/components/ui/badge'
import { fromCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  partially_shipped: 'outline',
  shipped: 'default',
  invoiced: 'default',
}

export default async function BatchesPage() {
  const batches = db.select().from(schema.batches).orderBy(desc(schema.batches.createdAt)).all()
  const invs = batches.length
    ? db.select().from(schema.invoices).all()
    : []
  const invMap = new Map(invs.map(i => [i.id, i]))

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">All ShipStation pushes, status, and resulting invoices.</p>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Batch</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Invoice</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No batches yet.</td></tr>
            )}
            {batches.map(b => {
              const inv = b.invoiceId ? invMap.get(b.invoiceId) : undefined
              return (
                <tr key={b.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/batches/${b.id}`} className="hover:underline">{b.id}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge variant={statusColor[b.status] || 'secondary'}>{b.status.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{inv?.id || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{inv ? fromCents(inv.totalCents) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
