import { desc, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { QueueTable, type QueueOrder } from './queue-table'
import { fromCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export default async function QueuePage() {
  const orders = db
    .select()
    .from(schema.orders)
    .where(inArray(schema.orders.status, ['queued', 'partial']))
    .orderBy(desc(schema.orders.urgent), desc(schema.orders.pulledAt))
    .all()

  const orderNums = orders.map(o => o.orderNumber)
  const items = orderNums.length
    ? db
        .select()
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.orderNumber, orderNums))
        .all()
        .filter(i => i.status === 'queued')
    : []

  const skuRows = db.select({ sku: schema.skus.sku }).from(schema.skus).all()
  const knownSkus = new Set(skuRows.map(r => r.sku))

  const emailCounts = new Map<string, number>()
  for (const o of orders) emailCounts.set(o.email, (emailCounts.get(o.email) || 0) + 1)
  const mergeEmails = new Set([...emailCounts.entries()].filter(([, n]) => n > 1).map(([e]) => e))

  const data: QueueOrder[] = orders.map(o => ({
    orderNumber: o.orderNumber,
    email: o.email,
    customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
    city: o.city,
    state: o.state,
    notes: o.notes,
    urgent: o.urgent,
    needsMerge: mergeEmails.has(o.email),
    ssVerifyStatus: o.ssVerifyStatus,
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
