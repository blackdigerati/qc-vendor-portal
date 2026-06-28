import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['vendor', 'admin'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const skus = sqliteTable('skus', {
  sku: text('sku').primaryKey(),
  description: text('description').notNull().default(''),
  productId: text('product_id'),
  baseCostCents: integer('base_cost_cents').notNull().default(0),
  shippingAddonCents: integer('shipping_addon_cents').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const orders = sqliteTable('orders', {
  orderNumber: text('order_number').primaryKey(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  address1: text('address1').notNull().default(''),
  address2: text('address2').notNull().default(''),
  city: text('city').notNull().default(''),
  state: text('state').notNull().default(''),
  zip: text('zip').notNull().default(''),
  country: text('country').notNull().default(''),
  notes: text('notes').notNull().default(''),
  urgent: integer('urgent', { mode: 'boolean' }).notNull().default(false),
  source: text('source', { enum: ['sheet', 'upload'] }).notNull(),
  pulledAt: integer('pulled_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  status: text('status', {
    enum: ['queued', 'partial', 'batched', 'shipped', 'cancelled'],
  }).notNull().default('queued'),
  // v2 — ShipStation verification
  ssVerifyStatus: text('ss_verify_status', {
    enum: ['unverified', 'verified', 'email_matched', 'not_found', 'error'],
  }).notNull().default('unverified'),
  ssShipmentId: text('ss_shipment_id'),
  ssVerifyCheckedAt: integer('ss_verify_checked_at', { mode: 'timestamp' }),
  ssVerifyError: text('ss_verify_error'),
  // v2 — merge tracking
  mergedIntoOrderNumber: text('merged_into_order_number'),
})

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().references(() => orders.orderNumber, { onDelete: 'cascade' }),
  sku: text('sku').notNull().default(''),
  name: text('name').notNull().default(''),
  qty: integer('qty').notNull().default(1),
  costOfGoodsCents: integer('cost_of_goods_cents').notNull().default(0),
  status: text('status', {
    enum: ['queued', 'batched', 'shipped', 'cancelled'],
  }).notNull().default('queued'),
  batchId: text('batch_id').references(() => batches.id),
  ssShipmentId: text('ss_shipment_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  // v2 — item-level notes + status flags
  statusFlag: text('status_flag', {
    enum: ['out_of_stock', 'backordered', 'discontinued', 'other'],
  }),
  pendingUntil: integer('pending_until', { mode: 'timestamp' }),
  notes: text('notes').notNull().default(''),
})

export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdBy: text('created_by').notNull().references(() => users.id),
  status: text('status', {
    enum: ['pending', 'partially_shipped', 'shipped', 'invoiced'],
  }).notNull().default('pending'),
  invoiceId: text('invoice_id').references((): any => invoices.id),
  // v2 — provenance
  source: text('source', { enum: ['manual', 'ss_label_sync'] }).notNull().default('ss_label_sync'),
  labelFetchAt: integer('label_fetch_at', { mode: 'timestamp' }),
})

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull().references(() => batches.id),
  totalCents: integer('total_cents').notNull().default(0),
  status: text('status', { enum: ['open', 'partial', 'paid'] }).notNull().default('open'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const invoiceLines = sqliteTable('invoice_lines', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  qty: integer('qty').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
  shippingAddonCents: integer('shipping_addon_cents').notNull().default(0),
  lineTotalCents: integer('line_total_cents').notNull(),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  amountCents: integer('amount_cents').notNull(),
  paidOn: integer('paid_on', { mode: 'timestamp' }).notNull(),
  refNote: text('ref_note').notNull().default(''),
  recordedBy: text('recorded_by').notNull().references(() => users.id),
  recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['vendor_recorded', 'approved', 'rejected'] }).notNull().default('vendor_recorded'),
})

export const paymentAllocations = sqliteTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  amountCents: integer('amount_cents').notNull(),
})

export const ledgerOpeningBalance = sqliteTable('ledger_opening_balance', {
  id: integer('id').primaryKey(),
  amountCents: integer('amount_cents').notNull().default(0),
  asOf: integer('as_of', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  setBy: text('set_by').references(() => users.id),
  setAt: integer('set_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const alertRecipients = sqliteTable('alert_recipients', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  eventType: text('event_type', { enum: ['new_orders', 'new_invoice'] }).notNull(),
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actor: text('actor'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

// v2 — singleton row tracking incremental "Fetch Printed Labels" pulls from ShipStation
export const ssSyncCursor = sqliteTable('ss_sync_cursor', {
  id: integer('id').primaryKey(),
  lastLabelFetchAt: integer('last_label_fetch_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export type User = typeof users.$inferSelect
export type Sku = typeof skus.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Batch = typeof batches.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type InvoiceLine = typeof invoiceLines.$inferSelect
export type Payment = typeof payments.$inferSelect
