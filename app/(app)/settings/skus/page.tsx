import { asc } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { SkusEditor, type SkuRow } from './skus-editor'

export const dynamic = 'force-dynamic'

export default async function SkusPage() {
  const rows = db.select().from(schema.skus).orderBy(asc(schema.skus.sku)).all()
  const data: SkuRow[] = rows.map(r => ({
    sku: r.sku,
    description: r.description,
    baseCost: (r.baseCostCents / 100).toFixed(2),
    shippingAddon: (r.shippingAddonCents / 100).toFixed(2),
    active: r.active,
  }))
  return <SkusEditor initial={data} />
}
