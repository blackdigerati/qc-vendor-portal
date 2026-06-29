import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('usage: tsx scripts/_delete_orders.ts <orderNumber> [<orderNumber> ...]')
  process.exit(1)
}
const db = new Database(process.env.DB_FILE || './qcvp.db')
db.pragma('foreign_keys = ON')

for (const num of args) {
  const order = db.prepare('SELECT order_number FROM orders WHERE order_number=?').get(num)
  if (!order) { console.log(`  ${num}: not in DB`); continue }
  // Clear any survivor links pointing to this order (so the FK doesn't break)
  db.prepare('UPDATE orders SET merged_into_order_number=NULL WHERE merged_into_order_number=?').run(num)
  // order_items cascade-deletes on order delete (FK has onDelete: cascade)
  const r = db.prepare('DELETE FROM orders WHERE order_number=?').run(num)
  console.log(`  ${num}: deleted (${r.changes} row)`)
}
