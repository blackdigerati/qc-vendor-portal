import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { RefreshBatchButton } from './refresh-button'

export const dynamic = 'force-dynamic'

function pill(text: string, tone: 'slate' | 'red' | 'emerald' | 'blue' | 'amber' = 'slate') {
  const map = {
    slate: 'bg-slate-200 text-slate-800',
    red: 'bg-red-600 text-white',
    emerald: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    blue: 'bg-blue-100 text-blue-900 border border-blue-300',
    amber: 'bg-amber-100 text-amber-900 border border-amber-300',
  }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${map[tone]}`}>{text}</span>
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = db.select().from(schema.batches).where(eq(schema.batches.id, id)).get()
  if (!batch) notFound()

  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.batchId, id)).all()
  const orderNums = [...new Set(items.map(i => i.orderNumber))]
  const orders = orderNums.length
    ? db.select().from(schema.orders).all().filter(o => orderNums.includes(o.orderNumber))
    : []
  const orderMap = new Map(orders.map(o => [o.orderNumber, o]))
  const invoice = batch.invoiceId
    ? db.select().from(schema.invoices).where(eq(schema.invoices.id, batch.invoiceId)).get()
    : null

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-mono">{batch.id}</h1>
          <div className="text-[13px] text-slate-600 mt-0.5 flex items-center gap-2">
            <span>Created {new Date(batch.createdAt).toLocaleString()}</span>
            <span className="text-slate-400">·</span>
            {pill(batch.status.replace('_', ' '), batch.status === 'invoiced' ? 'emerald' : batch.status === 'shipped' ? 'blue' : 'slate')}
            {invoice && (
              <>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-900">{invoice.id}</span>
                <span className="font-medium text-slate-900">{fromCents(invoice.totalCents)}</span>
              </>
            )}
          </div>
        </div>
        <RefreshBatchButton batchId={batch.id} />
      </div>
      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Customer</th>
              <th className="px-3 py-2 text-left font-semibold w-32">SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold w-16">Qty</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const o = orderMap.get(it.orderNumber)
              return (
                <tr key={it.id} className={`border-t border-slate-200 hover:bg-slate-50 ${o?.urgent ? 'border-l-2 border-l-red-500' : ''}`}>
                  <td className="px-3 py-1.5">
                    <span className="font-mono font-semibold">#{it.orderNumber}</span>
                    {o?.urgent && <span className="ml-1.5">{pill('URG', 'red')}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700">{o ? [o.firstName, o.lastName].filter(Boolean).join(' ') : '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 font-mono text-[11px]">{it.sku || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-700">{it.name}</td>
                  <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">×{it.qty}</td>
                  <td className="px-3 py-1.5">
                    {it.status === 'shipped' ? pill('Shipped', 'emerald') : it.status === 'batched' ? pill('Batched', 'blue') : pill(it.status, 'slate')}
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
