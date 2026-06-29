import { inArray, isNotNull, sql } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { OosTable, type OosRow } from './oos-table'

export const dynamic = 'force-dynamic'

export default async function OutOfStockPage() {
  const flaggedSkus = await db
    .select()
    .from(schema.skus)
    .where(isNotNull(schema.skus.statusFlag))

  const skuCodes = flaggedSkus.map(s => s.sku)
  const counts = skuCodes.length
    ? await db
        .select({
          sku: schema.orderItems.sku,
          c: sql<number>`count(*)`,
        })
        .from(schema.orderItems)
        .where(sql`${schema.orderItems.sku} IN (${sql.join(skuCodes.map(s => sql`${s}`), sql`, `)}) AND ${schema.orderItems.status} IN ('queued','partial','batched')`)
        .groupBy(schema.orderItems.sku)
    : []
  const countBySku = new Map(counts.map(r => [r.sku, r.c]))

  const rows: OosRow[] = flaggedSkus.map(s => ({
    sku: s.sku,
    name: s.description,
    flag: s.statusFlag!,
    pendingUntil: s.statusPendingUntil ? s.statusPendingUntil.toISOString().slice(0, 10) : null,
    notes: s.statusNotes,
    setAt: s.statusSetAt ? s.statusSetAt.toISOString() : null,
    orderCount: countBySku.get(s.sku) ?? 0,
  }))

  return <OosTable initial={rows} />
}
