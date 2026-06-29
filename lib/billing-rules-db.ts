import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { type BillingRule, DEFAULT_HANDLING_PER_ITEM_CENTS, DEFAULT_HANDLING_THRESHOLD_CENTS } from './billing-rules'

/** Server-only: read the current billing rule from DB, falling back to defaults. */
export async function getBillingRule(): Promise<BillingRule> {
  const row = (await db.select().from(schema.billingSettings).where(eq(schema.billingSettings.id, 1)))[0]
  if (row) {
    return {
      handlingThresholdCents: row.handlingThresholdCents,
      handlingPerItemCents: row.handlingPerItemCents,
    }
  }
  return {
    handlingThresholdCents: DEFAULT_HANDLING_THRESHOLD_CENTS,
    handlingPerItemCents: DEFAULT_HANDLING_PER_ITEM_CENTS,
  }
}

export async function upsertBillingRule(rule: BillingRule, userId: string) {
  const existing = (await db.select().from(schema.billingSettings).where(eq(schema.billingSettings.id, 1)))[0]
  const now = new Date()
  if (existing) {
    await db.update(schema.billingSettings).set({
      handlingThresholdCents: rule.handlingThresholdCents,
      handlingPerItemCents: rule.handlingPerItemCents,
      updatedAt: now,
      updatedBy: userId,
    }).where(eq(schema.billingSettings.id, 1))
  } else {
    await db.insert(schema.billingSettings).values({
      id: 1,
      handlingThresholdCents: rule.handlingThresholdCents,
      handlingPerItemCents: rule.handlingPerItemCents,
      updatedBy: userId,
    })
  }
}
