import { NextResponse } from 'next/server'
import { inArray, notInArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'

type SkuInput = { sku: string; description: string; baseCost: string | number; shippingAddon: string | number; active: boolean }

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const incoming = (Array.isArray(body.skus) ? body.skus : []) as SkuInput[]

  const clean = incoming
    .map(r => ({
      sku: String(r.sku || '').trim(),
      description: String(r.description || '').trim(),
      baseCostCents: toCents(r.baseCost),
      shippingAddonCents: toCents(r.shippingAddon),
      active: !!r.active,
    }))
    .filter(r => r.sku)

  if (clean.length === 0 && incoming.length > 0) {
    return NextResponse.json({ error: 'All rows missing a SKU code' }, { status: 400 })
  }

  // Upsert each
  for (const r of clean) {
    const existing = db.select().from(schema.skus).where(inArray(schema.skus.sku, [r.sku])).get()
    if (existing) {
      db.update(schema.skus)
        .set({
          description: r.description,
          baseCostCents: r.baseCostCents,
          shippingAddonCents: r.shippingAddonCents,
          active: r.active,
          updatedAt: new Date(),
        })
        .where(inArray(schema.skus.sku, [r.sku]))
        .run()
    } else {
      db.insert(schema.skus).values(r).run()
    }
  }

  // Delete any SKUs not present in the submitted set (treat editor as authoritative)
  const keepSkus = clean.map(r => r.sku)
  let deleted = 0
  if (keepSkus.length > 0) {
    const toDelete = db.select().from(schema.skus).where(notInArray(schema.skus.sku, keepSkus)).all()
    deleted = toDelete.length
    if (toDelete.length) db.delete(schema.skus).where(notInArray(schema.skus.sku, keepSkus)).run()
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'settings',
    entityId: 'skus',
    action: 'skus.updated',
    payload: { upserted: clean.length, deleted },
  })

  return NextResponse.json({ ok: true, upserted: clean.length, deleted })
}
