// Inspect what /v2/labels returns and what external_shipment_ids actually come
// back so we can see why portal orders don't match SS shipments.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'

const base = (process.env.SHIPSTATION_BASE || 'https://api.shipstation.com')
  .replace(/\/+$/, '')
  .replace(/\/v2$/, '')
const key = process.env.SHIPSTATION_API_KEY!
if (!key) { console.error('SHIPSTATION_API_KEY not set'); process.exit(1) }

const since = process.argv[2] || '2026-06-01T00:00:00Z'
const pageSize = 50

async function main() {
  const db = new Database(process.env.DB_FILE || './qcvp.db')
  const portalOrders = db.prepare('SELECT order_number, ss_verify_status, ss_shipment_id FROM orders').all() as { order_number: string; ss_verify_status: string; ss_shipment_id: string | null }[]
  const portalSet = new Set(portalOrders.map(o => o.order_number))
  console.log(`Portal DB has ${portalSet.size} orders.`)

  const qs = new URLSearchParams({
    created_at_start: since,
    page_size: String(pageSize),
    label_status: 'completed',
  })
  const r = await fetch(`${base}/v2/labels?${qs.toString()}`, { headers: { 'API-Key': key } })
  console.log(`GET /v2/labels?created_at_start=${since} → ${r.status}`)
  const data = await r.json() as { labels?: unknown[] }
  const labels = (data.labels || []) as Array<{ label_id?: string; shipment_id?: string; created_at?: string; voided_at?: string | null; tracking_number?: string }>
  console.log(`Labels returned: ${labels.length} (live: ${labels.filter(l => !l.voided_at).length})\n`)

  const seen = new Map<string, string>() // shipment_id -> external_shipment_id

  for (const l of labels.slice(0, 30)) {
    if (l.voided_at) continue
    if (!l.shipment_id) continue
    if (seen.has(l.shipment_id)) continue
    const sr = await fetch(`${base}/v2/shipments/${encodeURIComponent(l.shipment_id)}`, { headers: { 'API-Key': key } })
    if (!sr.ok) {
      console.log(`  ${l.shipment_id}  shipment fetch ${sr.status}`)
      continue
    }
    const ship = await sr.json() as { external_shipment_id?: string; order_number?: string; shipment_status?: string }
    const ext = ship.external_shipment_id || ship.order_number || ''
    seen.set(l.shipment_id, ext)
    const inPortal = portalSet.has(ext) ? '✅ IN PORTAL' : '❌ not in portal'
    console.log(`  label ${l.label_id?.slice(-8)}  ship ${l.shipment_id.slice(-12)}  ext=${ext.padEnd(12)}  status=${ship.shipment_status || '—'}  ${inPortal}`)
  }

  console.log('\nUnique shipments inspected:', seen.size)
  const matched = [...seen.values()].filter(v => portalSet.has(v))
  console.log('Matched portal orders:', matched.length)
  if (matched.length) console.log('  →', matched.join(', '))
}

main().catch(e => { console.error(e); process.exit(1) })
