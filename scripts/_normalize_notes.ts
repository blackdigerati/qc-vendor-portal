import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
const rows = db.prepare("SELECT order_number, notes FROM orders WHERE notes != ''").all() as { order_number: string; notes: string }[]
let updated = 0
for (const r of rows) {
  const parts = r.notes.split('|').map(p => p.replace(/\burgent\b/gi, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const cleaned = [...new Set(parts)].join(' | ')
  if (cleaned !== r.notes) {
    db.prepare('UPDATE orders SET notes=? WHERE order_number=?').run(cleaned, r.order_number)
    updated++
  }
}
console.log(`Normalized notes on ${updated} order(s).`)
