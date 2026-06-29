import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { type BillingRule, DEFAULT_HANDLING_PER_ITEM_CENTS, DEFAULT_HANDLING_THRESHOLD_CENTS } from './billing-rules'

/** Server-only: read the current billing rule from DB, falling back to defaults. */
export function getBillingRule(): BillingRule {
  const row = db.select().from(schema.billingSettings).where(eq(schema.billingSettings.id, 1)).get()
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

export function upsertBillingRule(rule: BillingRule, userId: string) {
  const existing = db.select().from(schema.billingSettings).where(eq(schema.billingSettings.id, 1)).get()
  const now = new Date()
  if (existing) {
    db.update(schema.billingSettings).set({
      handlingThresholdCents: rule.handlingThresholdCents,
      handlingPerItemCents: rule.handlingPerItemCents,
      updatedAt: now,
      updatedBy: userId,
    }).where(eq(schema.billingSettings.id, 1)).run()
  } else {
    db.insert(schema.billingSettings).values({
      id: 1,
      handlingThresholdCents: rule.handlingThresholdCents,
      handlingPerItemCents: rule.handlingPerItemCents,
      updatedBy: userId,
    }).run()
  }
}
