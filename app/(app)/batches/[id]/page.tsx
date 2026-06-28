import { notFound } from 'next/navigation'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { BatchLineEditor, type BatchLine } from './line-editor'

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
    ? db.select().from(schema.orders).where(inArray(schema.orders.orderNumber, orderNums)).all()
    : []
  const orderMap = new Map(orders.map(o => [o.orderNumber, o]))

  const skuList = [...new Set(items.map(i => i.sku).filter(Boolean))]
  const skuRows = skuList.length
    ? db.select().from(schema.skus).where(inArray(schema.skus.sku, skuList)).all()
    : []
  const skuMap = new Map(skuRows.map(r => [r.sku, r]))

  const invoice = batch.invoiceId
    ? db.select().from(schema.invoices).where(eq(schema.invoices.id, batch.invoiceId)).get()
    : null

  const initialLines: BatchLine[] = items.map(it => {
    const sku = skuMap.get(it.sku)
    const o = orderMap.get(it.orderNumber)
    // For invoiced batches, prefer the locked invoice line price; otherwise use the live SKU DB.
    const baseCost = sku ? (sku.baseCostCents / 100).toFixed(2) : (it.costOfGoodsCents / 100).toFixed(2)
    const shippingAddon = sku ? (sku.shippingAddonCents / 100).toFixed(2) : '0.00'
    return {
      orderItemId: it.id,
      orderNumber: it.orderNumber,
      urgent: !!o?.urgent,
      sku: it.sku,
      name: it.name,
      qty: it.qty,
      baseCost,
      shippingAddon,
      skuInDb: !!sku,
    }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-mono">{batch.id}</h1>
          <div className="text-[13px] text-slate-600 mt-0.5 flex items-center gap-2">
            <span>Created {new Date(batch.createdAt).toLocaleString()}</span>
            <span className="text-slate-400">·</span>
            {pill(batch.source === 'ss_label_sync' ? 'SS labels' : 'Manual', 'slate')}
            {batch.labelFetchAt && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-[12px]">Fetched {new Date(batch.labelFetchAt).toLocaleString()}</span>
              </>
            )}
            <span className="text-slate-400">·</span>
            {pill(batch.status.replace('_', ' '), batch.status === 'invoiced' ? 'emerald' : batch.status === 'shipped' ? 'blue' : 'slate')}
            {invoice && (
              <>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-900">{invoice.id}</span>
                <span className="font-medium text-slate-900 tabular-nums">{fromCents(invoice.totalCents)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <BatchLineEditor
        batchId={batch.id}
        initialLines={initialLines}
        invoiceId={invoice?.id ?? null}
        invoiceTotalCents={invoice?.totalCents ?? null}
      />
    </div>
  )
}
