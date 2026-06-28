/**
 * Billing rules — applied at invoice creation time. Not stored on SKUs.
 *
 * Current rule: any line whose unit cost (COG) is BELOW the threshold incurs a
 * per-item shipping/handling charge. Above the threshold, no handling.
 */

export const SHIPPING_THRESHOLD_CENTS = 4000     // $40.00
export const HANDLING_PER_ITEM_CENTS = 50        // $0.50

/**
 * Returns the per-item handling charge that should be added to a line, based on
 * the line's unit cost.
 */
export function computeHandlingPerItem(unitCostCents: number): number {
  return unitCostCents < SHIPPING_THRESHOLD_CENTS ? HANDLING_PER_ITEM_CENTS : 0
}

/**
 * Returns the total handling charge for a line (per-item × qty).
 */
export function computeHandlingForLine(unitCostCents: number, qty: number): number {
  return computeHandlingPerItem(unitCostCents) * qty
}
