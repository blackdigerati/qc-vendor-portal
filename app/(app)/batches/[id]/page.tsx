import { notFound } from 'next/navigation'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { getSession } from '@/lib/auth'
import { BatchLineEditor, type BatchLine } from './line-editor'
import { getBillingRule } from '@/lib/billing-rules-db'

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
  const session = await getSession()
  const isAdmin = session.role === 'admin'
  const batch = (await db.select().from(schema.batches).where(eq(schema.batches.id, id)))[0]
  if (!batch) notFound()

  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.batchId, id))
  const orderNums = [...new Set(items.map(i => i.orderNumber))]
  const orders = orderNums.length
    ? await db.select().from(schema.orders).where(inArray(schema.orders.orderNumber, orderNums))
    : []
  const orderMap = new Map(orders.map(o => [o.orderNumber, o]))

  const skuList = [...new Set(items.map(i => i.sku).filter(Boolean))]
  const skuRows = skuList.length
    ? await db.select().from(schema.skus).where(inArray(schema.skus.sku, skuList))
    : []
  const skuMap = new Map(skuRows.map(r => [r.sku, r]))

  const invoice = batch.invoiceId
    ? (await db.select().from(schema.invoices).where(eq(schema.invoices.id, batch.invoiceId)))[0]
    : null

  const initialLines: BatchLine[] = items.map(it => {
    const sku = skuMap.get(it.sku)
    const o = orderMap.get(it.orderNumber)
    // Prefer the SKU DB cost; fall back to the per-line CSV cost.
    const baseCost = sku ? (sku.baseCostCents / 100).toFixed(2) : (it.costOfGoodsCents / 100).toFixed(2)
    return {
      orderItemId: it.id,
      orderNumber: it.orderNumber,
      urgent: !!o?.urgent,
      sku: it.sku,
      name: it.name,
      qty: it.qty,
      baseCost,
      skuInDb: !!sku,
      mergedFromOrderNumber: it.mergedFromOrderNumber,
    }
  })

  // Which order numbers in this batch absorbed merges? Used to badge the order header.
  const mergedFromByOrder = new Map<string, string[]>()
  for (const it of items) {
    if (!it.mergedFromOrderNumber) continue
    const list = mergedFromByOrder.get(it.orderNumber) || []
    if (!list.includes(it.mergedFromOrderNumber)) list.push(it.mergedFromOrderNumber)
    mergedFromByOrder.set(it.orderNumber, list)
  }

  // For each order in this batch, find items still queued elsewhere (bounced
  // back to queue or never made it into a label). Surfaces as a "Partial · N
  // still queued" badge that expands inline to show the actual items.
  const partialPendingByOrder = new Map<string, { id: string; sku: string; name: string; qty: number }[]>()
  if (orderNums.length) {
    const allItemsForOrders = await db
      .select()
      .from(schema.orderItems)
      .where(inArray(schema.orderItems.orderNumber, orderNums))
    for (const it of allItemsForOrders) {
      if (it.status !== 'queued') continue
      const list = partialPendingByOrder.get(it.orderNumber) || []
      list.push({ id: it.id, sku: it.sku, name: it.name, qty: it.qty })
      partialPendingByOrder.set(it.orderNumber, list)
    }
  }

  // Duplicate-shipment detection: if the same order_number appears across more
  // than one distinct ssShipmentId in this batch, the vendor probably printed
  // two labels for the same order — we'd otherwise bill twice. Flag at top.
  const shipmentsByOrder = new Map<string, Set<string>>()
  for (const it of items) {
    if (!it.ssShipmentId) continue
    const set = shipmentsByOrder.get(it.orderNumber) || new Set<string>()
    set.add(it.ssShipmentId)
    shipmentsByOrder.set(it.orderNumber, set)
  }
  const duplicateOrders = [...shipmentsByOrder.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([orderNumber, set]) => ({ orderNumber, shipmentCount: set.size }))

  return (
    <div className="space-y-3">
      {duplicateOrders.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-md px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-[12px] font-bold flex-shrink-0">!</span>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-red-900">
                Duplicate shipment{duplicateOrders.length > 1 ? 's' : ''} detected — review before invoicing
              </div>
              <div className="text-[12px] text-red-800 mt-0.5">
                The same order appears on more than one label in this batch. If the vendor shipped the order once, remove the extra line(s) to avoid double-billing.
              </div>
              <ul className="mt-2 space-y-1">
                {duplicateOrders.map(d => (
                  <li key={d.orderNumber} className="text-[12px] text-red-900">
                    <span className="font-mono font-semibold">#{d.orderNumber}</span>
                    <span className="ml-2 text-red-700">— {d.shipmentCount} labels in this batch</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
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
        isAdmin={isAdmin}
        mergedFromByOrder={Object.fromEntries(mergedFromByOrder)}
        partialPendingByOrder={Object.fromEntries(partialPendingByOrder)}
        billingRule={await getBillingRule()}
      />
    </div>
  )
}
