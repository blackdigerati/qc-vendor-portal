// Wipe payments + their allocations, invoices + their lines, and reopen any
// invoiced batches. Order data, SKUs, opening balance, etc. are left alone.
import 'dotenv/config'
import Database from 'better-sqlite3'

const file = process.env.DB_FILE || './qcvp.db'
const db = new Database(file)
db.pragma('foreign_keys = ON')

const counts = {
  payments: 0,
  allocations: 0,
  invoiceLines: 0,
  invoices: 0,
  batchesReopened: 0,
}

const tx = db.transaction(() => {
  counts.allocations = db.prepare('DELETE FROM payment_allocations').run().changes
  counts.payments = db.prepare('DELETE FROM payments').run().changes
  counts.batchesReopened = db.prepare(
    "UPDATE batches SET status='shipped', invoice_id=NULL WHERE invoice_id IS NOT NULL OR status='invoiced'"
  ).run().changes
  counts.invoiceLines = db.prepare('DELETE FROM invoice_lines').run().changes
  counts.invoices = db.prepare('DELETE FROM invoices').run().changes
  db.prepare(
    "INSERT INTO audit_log (id, actor, entity_type, entity_id, action, payload_json) VALUES (?, NULL, 'system', ?, 'test.reset', ?)"
  ).run('al_reset_' + Date.now().toString(36), 'reset', JSON.stringify(counts))
})

tx()
console.log('Reset complete:', counts)
