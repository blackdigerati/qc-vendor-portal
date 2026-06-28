import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

const base = (process.env.SHIPSTATION_BASE || 'https://api.shipstation.com').replace(/\/+$/, '').replace(/\/v2$/, '')
const key = process.env.SHIPSTATION_API_KEY
console.log('base:', base)
console.log('key present:', !!key, key ? '(length ' + key.length + ')' : '')

if (!key) {
  console.error('SHIPSTATION_API_KEY is empty')
  process.exit(1)
}

;(async () => {
  // Try the order # from the screenshot
  const orderNum = '214240'
  const url = base + '/v2/shipments?external_shipment_id=' + encodeURIComponent(orderNum) + '&page_size=5'
  console.log('GET', url)
  const r = await fetch(url, { headers: { 'API-Key': key } })
  console.log('status:', r.status)
  const text = await r.text()
  console.log('body (first 500):', text.slice(0, 500))
})()
