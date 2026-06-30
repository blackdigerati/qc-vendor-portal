import Link from 'next/link'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { computeHandlingPerItem } from '@/lib/billing-rules'
import { getBillingRule } from '@/lib/billing-rules-db'
import { FetchLabelsButton } from './fetch-labels-button'
import { SimulateLabelsDialog, type SimQueueOrder } from './simulate-labels-dialog'

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
  const batches = await db.select().from(schema.batches).orderBy(desc(schema.batches.createdAt))
  const invs = batches.length ? await db.select().from(schema.invoices) : []
  const invMap = new Map(invs.map(i => [i.id, i]))
  const cursor = (await db.select().from(schema.ssSyncCursor).where(eq(schema.ssSyncCursor.id, 1)))[0]
  const isDev = process.env.NODE_ENV !== 'production'

  // Tentative totals — for uninvoiced batches we still want to show the running
  // dollar value using current SKU prices + billing rule, so the vendor can
  // eyeball it before clicking Create Invoice.
  const tentativeTotalByBatch = new Map<string, number>()
  const uninvoiced = batches.filter(b => !b.invoiceId).map(b => b.id)
  if (uninvoiced.length) {
    const rule = await getBillingRule()
    const items = await db
      .select()
      .from(schema.orderItems)
      .where(inArray(schema.orderItems.batchId, uninvoiced))
    const skus = [...new Set(items.map(i => i.sku).filter(Boolean))]
    const skuRows = skus.length ? await db.select().from(schema.skus).where(inArray(schema.skus.sku, skus)) : []
    const skuMap = new Map(skuRows.map(r => [r.sku, r]))
    for (const it of items) {
      const sku = skuMap.get(it.sku)
      const unit = sku?.baseCostCents ?? it.costOfGoodsCents
      const handling = computeHandlingPerItem(unit, rule)
      const line = (unit + handling) * it.qty
      tentativeTotalByBatch.set(it.batchId!, (tentativeTotalByBatch.get(it.batchId!) || 0) + line)
    }
  }

  // Build queue snapshot for the dev simulate dialog
  let simQueue: SimQueueOrder[] = []
  if (isDev) {
    const queuedOrders = await db
      .select()
      .from(schema.orders)
      .where(inArray(schema.orders.status, ['queued', 'partial']))
    const orderNums = queuedOrders.map(o => o.orderNumber)
    const items = orderNums.length
      ? (await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderNumber, orderNums))).filter(i => i.status === 'queued')
      : []
    simQueue = queuedOrders.map(o => ({
      orderNumber: o.orderNumber,
      customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
      items: items
        .filter(i => i.orderNumber === o.orderNumber)
        .map(i => ({ id: i.id, sku: i.sku, name: i.name, qty: i.qty })),
    })).filter(o => o.items.length > 0)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Batches</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{batches.length} batch{batches.length === 1 ? '' : 'es'} total · built from ShipStation labels.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDev && <SimulateLabelsDialog queue={simQueue} />}
          <FetchLabelsButton lastFetchISO={cursor?.lastLabelFetchAt?.toISOString() ?? null} />
        </div>
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
              const statusContent = statusPill(b.status)
              return (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-semibold">
                    <Link href={`/batches/${b.id}`} className="hover:underline text-slate-900">{b.id}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-slate-600 text-[12px]">{b.source === 'ss_label_sync' ? 'SS labels' : 'Manual'}</td>
                  <td className="px-3 py-1.5">
                    {inv ? <Link href={`/invoices/${inv.id}`} className="hover:opacity-80">{statusContent}</Link> : statusContent}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 font-mono">
                    {inv ? <Link href={`/invoices/${inv.id}`} className="hover:text-emerald-700 hover:underline">{inv.id}</Link> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                    {inv ? (
                      fromCents(inv.totalCents)
                    ) : tentativeTotalByBatch.has(b.id) ? (
                      <span className="text-slate-500 italic" title="Tentative — based on current SKU prices. Locks when invoiced.">
                        {fromCents(tentativeTotalByBatch.get(b.id) || 0)}
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-400 not-italic">tentative</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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
