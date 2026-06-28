import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'

const id = process.argv[2]
if (!id) { console.error('usage: tsx scripts/_delete_batch.ts <batch-id>'); process.exit(1) }
const db = new Database(process.env.DB_FILE || './qcvp.db')
db.pragma('foreign_keys = OFF')
const lines = db.prepare("UPDATE order_items SET batch_id=NULL, status='queued', ss_shipment_id=NULL WHERE batch_id=?").run(id)
const inv = db.prepare("DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE batch_id=?)").run(id)
const i2 = db.prepare("DELETE FROM invoices WHERE batch_id=?").run(id)
const b = db.prepare("DELETE FROM batches WHERE id=?").run(id)
db.pragma('foreign_keys = ON')
console.log(`Deleted batch ${id}: ${b.changes} batch row, ${lines.changes} order_items reset, ${i2.changes} invoice(s) + ${inv.changes} line(s) removed`)
