import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { writeAudit } from '@/lib/audit'

type Body = {
  description?: string
  productId?: string | null
  baseCost?: string | number
  shippingAddon?: string | number
  active?: boolean
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sku: string }> }) {
  const s = await requireSession()
  const { sku } = await params
  const body = (await req.json().catch(() => ({}))) as Body

  let existing = (await db.select().from(schema.skus).where(eq(schema.skus.sku, sku)))[0]

  const patch: Partial<typeof schema.skus.$inferInsert> = { updatedAt: new Date() }
  if ('description' in body) patch.description = String(body.description ?? '')
  if ('productId' in body) patch.productId = body.productId ? String(body.productId) : null
  if ('baseCost' in body) patch.baseCostCents = toCents(body.baseCost)
  if ('shippingAddon' in body) patch.shippingAddonCents = toCents(body.shippingAddon)
  if ('active' in body) patch.active = !!body.active

  if (!existing) {
    // Auto-create on first save (covers SKUs that came in via CSV but never existed in DB)
    await db.insert(schema.skus).values({
      sku,
      description: patch.description ?? '',
      productId: patch.productId ?? null,
      baseCostCents: patch.baseCostCents ?? 0,
      shippingAddonCents: patch.shippingAddonCents ?? 0,
      active: patch.active ?? true,
    })
    existing = (await db.select().from(schema.skus).where(eq(schema.skus.sku, sku)))[0]
  } else {
    await db.update(schema.skus).set(patch).where(eq(schema.skus.sku, sku))
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'sku',
    entityId: sku,
    action: 'sku.updated',
    payload: { changes: patch, created: !existing },
  })

  return NextResponse.json({ ok: true })
}
