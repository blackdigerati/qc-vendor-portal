import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { newId } from './ids'
import { writeAudit } from './audit'
import { sendAlert } from './mailer'
import { fromCents } from './money'
import { computeHandlingPerItem } from './billing-rules'

function nextInvoiceId(): string {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const ids = db.select({ id: schema.invoices.id }).from(schema.invoices).all().map(r => r.id)
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (n > max) max = n
  }
  return prefix + String(max + 1).padStart(4, '0')
}

export type InvoiceCreateResult = {
  invoiceId: string
  totalCents: number
  warnings: string[]
}

/**
 * Roll a shipped batch into an invoice. Uses SKU DB as the source of truth for unit_cost and shipping_addon.
 * Cross-checks each line against the CSV's Cost of Goods; mismatch becomes a warning.
 */
export async function createInvoiceForBatch(batchId: string, actor?: string): Promise<InvoiceCreateResult | { error: string }> {
  const batch = db.select().from(schema.batches).where(eq(schema.batches.id, batchId)).get()
  if (!batch) return { error: 'Batch not found' }
  if (batch.invoiceId) {
    const inv = db.select().from(schema.invoices).where(eq(schema.invoices.id, batch.invoiceId)).get()
    return inv ? { invoiceId: inv.id, totalCents: inv.totalCents, warnings: [] } : { error: 'Invoice missing' }
  }

  const items = db.select().from(schema.orderItems).where(eq(schema.orderItems.batchId, batchId)).all()
  if (items.length === 0) return { error: 'No items in batch' }

  const skuRows = db
    .select()
    .from(schema.skus)
    .where(inArray(schema.skus.sku, [...new Set(items.map(i => i.sku).filter(Boolean))]))
    .all()
  const skuMap = new Map(skuRows.map(r => [r.sku, r]))

  const warnings: string[] = []
  const invoiceId = nextInvoiceId()
  let total = 0
  const lines: (typeof schema.invoiceLines.$inferInsert)[] = []

  for (const it of items) {
    const sku = skuMap.get(it.sku)
    if (!sku) {
      warnings.push(`SKU "${it.sku}" not in DB — invoiced at $0; set price and re-issue if needed.`)
    }
    const unitCost = sku?.baseCostCents ?? 0
    // Handling/shipping is rule-based at invoice time (not stored on SKU):
    // any line whose unit cost is below the threshold carries a per-item handling fee.
    const handlingPerItem = computeHandlingPerItem(unitCost)
    const lineTotal = (unitCost + handlingPerItem) * it.qty
    if (sku && it.costOfGoodsCents > 0 && unitCost !== it.costOfGoodsCents) {
      warnings.push(
        `Price mismatch on ${sku.sku}: SKU DB ${fromCents(unitCost)} vs CSV Cost of Goods ${fromCents(it.costOfGoodsCents)} — used DB.`,
      )
    }
    total += lineTotal
    lines.push({
      id: newId('il'),
      invoiceId,
      sku: it.sku,
      qty: it.qty,
      unitCostCents: unitCost,
      shippingAddonCents: handlingPerItem,
      lineTotalCents: lineTotal,
    })
  }

  db.insert(schema.invoices).values({
    id: invoiceId,
    batchId,
    totalCents: total,
    status: 'open',
  }).run()
  for (const ln of lines) db.insert(schema.invoiceLines).values(ln).run()
  db.update(schema.batches).set({ status: 'invoiced', invoiceId }).where(eq(schema.batches.id, batchId)).run()

  await writeAudit({
    actor,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.created',
    payload: { batchId, totalCents: total, warnings },
  })

  await sendAlert(
    'new_invoice',
    `Vendor Portal: invoice ${invoiceId} for batch ${batchId} — ${fromCents(total)}`,
    [
      `Batch ${batchId} is fully shipped.`,
      `Invoice ${invoiceId}: ${fromCents(total)}.`,
      warnings.length ? `\nWarnings:\n- ${warnings.join('\n- ')}` : '',
    ].filter(Boolean).join('\n'),
  )

  return { invoiceId, totalCents: total, warnings }
}
