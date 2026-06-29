/**
 * Billing rules — applied at invoice creation time. Not stored on SKUs.
 *
 * Current rule: any line whose unit cost (COG) is BELOW the threshold incurs a
 * per-item shipping/handling charge. Above the threshold, no handling.
 */

export const DEFAULT_HANDLING_THRESHOLD_CENTS = 4000     // $40.00
export const DEFAULT_HANDLING_PER_ITEM_CENTS = 50        // $0.50

// Legacy aliases (kept so existing imports don't break) — these now represent
// the *defaults*, not the actively configured values. Read DB for current values.
export const SHIPPING_THRESHOLD_CENTS = DEFAULT_HANDLING_THRESHOLD_CENTS
export const HANDLING_PER_ITEM_CENTS = DEFAULT_HANDLING_PER_ITEM_CENTS

export type BillingRule = {
  handlingThresholdCents: number
  handlingPerItemCents: number
}

const DEFAULT_RULE: BillingRule = {
  handlingThresholdCents: DEFAULT_HANDLING_THRESHOLD_CENTS,
  handlingPerItemCents: DEFAULT_HANDLING_PER_ITEM_CENTS,
}

export function computeHandlingPerItem(unitCostCents: number, rule: BillingRule = DEFAULT_RULE): number {
  return unitCostCents < rule.handlingThresholdCents ? rule.handlingPerItemCents : 0
}

export function computeHandlingForLine(unitCostCents: number, qty: number, rule: BillingRule = DEFAULT_RULE): number {
  return computeHandlingPerItem(unitCostCents, rule) * qty
}
