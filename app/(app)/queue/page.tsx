import { desc, eq, inArray, ne } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { QueueTable, type QueueOrder } from './queue-table'
import { fromCents } from '@/lib/money'

export const dynamic = 'force-dynamic'

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

  // Merge candidates: queued orders sharing an email
  const emailCounts = new Map<string, number>()
  for (const o of orders) emailCounts.set(o.email, (emailCounts.get(o.email) || 0) + 1)
  const mergeEmails = new Set([...emailCounts.entries()].filter(([, n]) => n > 1).map(([e]) => e))

  const data: QueueOrder[] = orders.map(o => ({
    orderNumber: o.orderNumber,
    email: o.email,
    customer: [o.firstName, o.lastName].filter(Boolean).join(' '),
    city: o.city,
    state: o.state,
    urgent: o.urgent,
    needsMerge: mergeEmails.has(o.email),
    items: items
      .filter(i => i.orderNumber === o.orderNumber)
      .map(i => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        qty: i.qty,
        cost: fromCents(i.costOfGoodsCents),
        skuMissing: !!i.sku && !knownSkus.has(i.sku),
      })),
  }))

  const totalMissing = data.reduce((acc, o) => acc + o.items.filter(i => i.skuMissing).length, 0)

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.length} order{data.length === 1 ? '' : 's'} ready to ship.
            {totalMissing > 0 && (
              <span className="text-amber-600 ml-2">
                {totalMissing} item{totalMissing === 1 ? '' : 's'} have unknown SKUs (set cost before billing).
              </span>
            )}
          </p>
        </div>
      </div>
      <QueueTable orders={data} />
    </div>
  )
}
