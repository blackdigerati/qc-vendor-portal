// Wipe all transactional data for a clean test run.
// Keeps: users, ledger_opening_balance, alert_recipients.
// Wipes: orders, order_items, batches, invoices, invoice_lines, payments,
//        payment_allocations, skus, ss_sync_cursor, audit_log.
import 'dotenv/config'
import Database from 'better-sqlite3'

const file = process.env.DB_FILE || './qcvp.db'
const db = new Database(file)
// FKs OFF for this wipe — batches.invoice_id <-> invoices.batch_id is a circular FK
db.pragma('foreign_keys = OFF')

const counts: Record<string, number> = {}

const tx = db.transaction(() => {
  counts.payment_allocations = db.prepare('DELETE FROM payment_allocations').run().changes
  counts.payments = db.prepare('DELETE FROM payments').run().changes
  counts.invoice_lines = db.prepare('DELETE FROM invoice_lines').run().changes
  counts.invoices = db.prepare('DELETE FROM invoices').run().changes
  counts.order_items = db.prepare('DELETE FROM order_items').run().changes
  counts.batches = db.prepare('DELETE FROM batches').run().changes
  counts.orders = db.prepare('DELETE FROM orders').run().changes
  counts.skus = db.prepare('DELETE FROM skus').run().changes
  counts.ss_sync_cursor = db.prepare('DELETE FROM ss_sync_cursor').run().changes
  counts.audit_log = db.prepare('DELETE FROM audit_log').run().changes
})

tx()
db.pragma('foreign_keys = ON')
console.log('Reset complete:')
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)
console.log('Kept: users, ledger_opening_balance, alert_recipients')
