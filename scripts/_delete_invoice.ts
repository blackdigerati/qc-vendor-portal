// One-shot maintenance script. Usage:
//   npx tsx scripts/_delete_invoice.ts INV-2026-0001
import 'dotenv/config'
import Database from 'better-sqlite3'

const invId = process.argv[2]
if (!invId) {
  console.error('usage: tsx scripts/_delete_invoice.ts <INV-id>')
  process.exit(1)
}
const file = process.env.DB_FILE || './qcvp.db'
const db = new Database(file)
db.pragma('foreign_keys = ON')

const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId)
if (!inv) { console.log('Invoice not found:', invId); process.exit(0) }

// 1) Clear FK references (batches.invoice_id → invoices.id)
const batches = db.prepare("UPDATE batches SET status='shipped', invoice_id=NULL WHERE invoice_id=?").run(invId)
// 2) Remove dependent rows
const lines = db.prepare('DELETE FROM invoice_lines WHERE invoice_id=?').run(invId)
// 3) Remove invoice itself
db.prepare('DELETE FROM invoices WHERE id=?').run(invId)
db.prepare(
  "INSERT INTO audit_log (id, actor, entity_type, entity_id, action, payload_json) VALUES (?, NULL, 'invoice', ?, 'invoice.deleted', ?)",
).run('al_manual_' + Date.now().toString(36), invId, JSON.stringify({ via: 'scripts/_delete_invoice.ts' }))
console.log(`Deleted ${invId}: ${lines.changes} line(s) removed, ${batches.changes} batch reopened.`)
