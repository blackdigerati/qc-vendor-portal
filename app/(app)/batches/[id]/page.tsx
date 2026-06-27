import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { Badge } from '@/components/ui/badge'
import { fromCents } from '@/lib/money'
import { RefreshBatchButton } from './refresh-button'

export const dynamic = 'force-dynamic'

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
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{batch.id}</h1>
          <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span>Created {new Date(batch.createdAt).toLocaleString()}</span>
            <Badge variant="secondary">{batch.status.replace('_', ' ')}</Badge>
            {invoice && <Badge>{invoice.id} · {fromCents(invoice.totalCents)}</Badge>}
          </div>
        </div>
        <RefreshBatchButton batchId={batch.id} />
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const o = orderMap.get(it.orderNumber)
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    #{it.orderNumber}
                    {o?.urgent && <Badge variant="destructive" className="ml-2">URGENT</Badge>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{o ? [o.firstName, o.lastName].filter(Boolean).join(' ') : '—'}</td>
                  <td className="px-4 py-2 text-slate-600 font-mono text-xs">{it.sku || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{it.name}</td>
                  <td className="px-4 py-2 text-right text-slate-600">×{it.qty}</td>
                  <td className="px-4 py-2"><Badge variant={it.status === 'shipped' ? 'default' : 'secondary'}>{it.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
