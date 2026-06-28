// For a given order#, show SS shipment items vs portal queued items, side-by-side.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'

const base = (process.env.SHIPSTATION_BASE || 'https://api.shipstation.com').replace(/\/+$/, '').replace(/\/v2$/, '')
const key = process.env.SHIPSTATION_API_KEY!

const orderNum = process.argv[2]
if (!orderNum) { console.error('usage: tsx scripts/_compare_skus.ts <order#>'); process.exit(1) }

async function main() {
  const db = new Database(process.env.DB_FILE || './qcvp.db')
  const portalItems = db.prepare('SELECT id, sku, name, qty, status FROM order_items WHERE order_number=?').all(orderNum) as { id: string; sku: string; name: string; qty: number; status: string }[]
  console.log(`\nPortal items for #${orderNum}:`)
  for (const i of portalItems) console.log(`  sku="${i.sku}"  qty=${i.qty}  status=${i.status}  name="${i.name}"`)

  const r = await fetch(`${base}/v2/shipments?external_shipment_id=${encodeURIComponent(orderNum)}`, { headers: { 'API-Key': key } })
  const data = await r.json() as { shipments?: unknown[] }
  const ships = (data.shipments || []) as Array<{ shipment_id?: string; external_shipment_id?: string; items?: Array<{ sku?: string; name?: string; quantity?: number }> }>
  console.log(`\nSS shipments for ext=#${orderNum}: ${ships.length}`)
  for (const s of ships) {
    console.log(`  shipment_id=${s.shipment_id}  ext=${s.external_shipment_id}`)
    for (const it of s.items || []) {
      console.log(`    sku="${it.sku}"  qty=${it.quantity}  name="${it.name}"`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
