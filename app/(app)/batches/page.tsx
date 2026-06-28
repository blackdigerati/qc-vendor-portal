import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { FetchLabelsButton } from './fetch-labels-button'

export const dynamic = 'force-dynamic'

function statusPill(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-slate-200 text-slate-800',
    partially_shipped: 'bg-amber-100 text-amber-900 border border-amber-300',
    shipped: 'bg-blue-100 text-blue-900 border border-blue-300',
    invoiced: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${map[status] || 'bg-slate-200 text-slate-800'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default async function BatchesPage() {
  const batches = db.select().from(schema.batches).orderBy(desc(schema.batches.createdAt)).all()
  const invs = batches.length ? db.select().from(schema.invoices).all() : []
  const invMap = new Map(invs.map(i => [i.id, i]))
  const cursor = db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)).get()

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Batches</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{batches.length} batch{batches.length === 1 ? '' : 'es'} total · built from ShipStation labels.</p>
        </div>
        <FetchLabelsButton lastFetchISO={cursor?.lastLabelFetchAt?.toISOString() ?? null} />
      </div>
      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-36">Batch</th>
              <th className="px-3 py-2 text-left font-semibold w-44">Created</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Source</th>
              <th className="px-3 py-2 text-left font-semibold w-36">Status</th>
              <th className="px-3 py-2 text-left font-semibold w-36">Invoice</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No batches yet. Click <span className="font-medium text-slate-700">Fetch Printed Labels</span> to pull from ShipStation.</td></tr>
            )}
            {batches.map(b => {
              const inv = b.invoiceId ? invMap.get(b.invoiceId) : undefined
              return (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-semibold">
                    <Link href={`/batches/${b.id}`} className="hover:underline text-slate-900">{b.id}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-slate-600 text-[12px]">{b.source === 'ss_label_sync' ? 'SS labels' : 'Manual'}</td>
                  <td className="px-3 py-1.5">{statusPill(b.status)}</td>
                  <td className="px-3 py-1.5 text-slate-600 font-mono">{inv?.id || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{inv ? fromCents(inv.totalCents) : <span className="text-slate-400">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
