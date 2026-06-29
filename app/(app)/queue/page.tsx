import { desc, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { QueueTable, type QueueOrder } from './queue-table'
import { fromCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export default async function QueuePage() {
  const orders = await db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, ['queued', 'partial']))
    .orderBy(desc(schema.orders.urgent), desc(schema.orders.pulledAt))

  const orderNums = orders.map(o => o.orderNumber)
  const allItemsForOrders = orderNums.length
    ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderNumber, orderNums))
    : []
  const items = allItemsForOrders.filter(i => i.status === 'queued')
  // Count of items per order that have already shipped in a prior batch — used
  // to flag the order row as "PARTIAL · N shipped" in the queue.
  const shippedCountByOrder = new Map<string, number>()
  for (const it of allItemsForOrders) {
    if (it.status !== 'shipped') continue
    shippedCountByOrder.set(it.orderNumber, (shippedCountByOrder.get(it.orderNumber) || 0) + 1)
  }

  const skuRows = await db.select({ sku: schema.skus.sku }).from(schema.skus)
  const knownSkus = new Set(skuRows.map(r => r.sku))

  const emailCounts = new Map<string, number>()
  for (const o of orders) emailCounts.set(o.email, (emailCounts.get(o.email) || 0) + 1)
  const mergeEmails = new Set([...emailCounts.entries()].filter(([, n]) => n > 1).map(([e]) => e))

  // Build survivor → [absorbed order#s] map from the orders table
  const mergedRows = await db
    .select()
    .from(schema.orders)
    .where(isNotNull(schema.orders.mergedIntoOrderNumber))
  const mergedFrom = new Map<string, string[]>()
  for (const m of mergedRows) {
    if (!m.mergedIntoOrderNumber) continue
    const list = mergedFrom.get(m.mergedIntoOrderNumber) || []
    list.push(m.orderNumber)
    mergedFrom.set(m.mergedIntoOrderNumber, list)
  }

  const data: QueueOrder[] = orders.map(o => ({
    orderNumber: o.orderNumber,
    email: o.email,
    customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
    city: o.city,
    state: o.state,
    notes: o.notes,
    urgent: o.urgent,
    needsMerge: mergeEmails.has(o.email),
    mergedFrom: mergedFrom.get(o.orderNumber) || [],
    ssVerifyStatus: o.ssVerifyStatus,
    partialShippedCount: shippedCountByOrder.get(o.orderNumber) || 0,
    items: items
      .filter(i => i.orderNumber === o.orderNumber)
      .map(i => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        qty: i.qty,
        unitPrice: fromCents(i.costOfGoodsCents),
        skuMissing: !!i.sku && !knownSkus.has(i.sku),
        statusFlag: i.statusFlag,
        pendingUntil: isoDate(i.pendingUntil as Date | null),
        itemNotes: i.notes,
        mergedFromOrderNumber: i.mergedFromOrderNumber,
      })),
  }))

  const urgentCount = data.filter(o => o.urgent).length
  const totalMissing = data.reduce((acc, o) => acc + o.items.filter(i => i.skuMissing).length, 0)
  const flaggedCount = data.reduce((acc, o) => acc + o.items.filter(i => i.statusFlag).length, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Order Queue</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            <span className="font-medium text-slate-900">{data.length}</span> ready to ship
            {urgentCount > 0 && <> · <span className="text-red-600 font-medium">{urgentCount} urgent</span></>}
            {flaggedCount > 0 && <> · <span className="text-amber-700 font-medium">{flaggedCount} flagged items</span></>}
            {totalMissing > 0 && <> · <span className="text-amber-700 font-medium">{totalMissing} items missing SKU</span></>}
          </p>
        </div>
      </div>
      <QueueTable
        orders={data}
        defaultSheetId={process.env.GOOGLE_SHEET_ID || ''}
        defaultSheetTab={process.env.GOOGLE_SHEET_TAB || 'Orders'}
      />
    </div>
  )
}
