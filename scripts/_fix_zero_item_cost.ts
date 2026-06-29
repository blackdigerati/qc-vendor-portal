import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
const rows = db.prepare(`
  SELECT oi.id, oi.sku, oi.cost_of_goods_cents, s.base_cost_cents
  FROM order_items oi
  JOIN skus s ON s.sku = oi.sku
  WHERE oi.cost_of_goods_cents = 0 AND s.base_cost_cents > 0 AND oi.status = 'queued'
`).all() as { id: string; sku: string; cost_of_goods_cents: number; base_cost_cents: number }[]
let updated = 0
for (const r of rows) {
  db.prepare('UPDATE order_items SET cost_of_goods_cents=? WHERE id=?').run(r.base_cost_cents, r.id)
  updated++
}
console.log(`Backfilled COG from SKU catalog on ${updated} item(s).`)
