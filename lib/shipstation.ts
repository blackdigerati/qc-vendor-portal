type SSShipment = {
  shipment_id: string
  external_shipment_id?: string
  order_number?: string
  shipment_status?: string
  ship_to?: { name?: string; email?: string }
}

type SSLabel = {
  label_id?: string
  shipment_id?: string
  tracking_number?: string
  tracking_status?: string
  carrier_code?: string
  voided_at?: string | null
  ship_date?: string
  created_at?: string
}

function getBase() {
  const raw = process.env.SHIPSTATION_BASE || 'https://api.shipstation.com'
  const trimmed = raw.replace(/\/+$/, '')
  return trimmed.endsWith('/v2') ? trimmed.slice(0, -3) : trimmed
}

function headers(): HeadersInit {
  const key = process.env.SHIPSTATION_API_KEY
  if (!key) throw new Error('SHIPSTATION_API_KEY not set')
  return { 'API-Key': key, 'Content-Type': 'application/json' }
}

async function ssFetch(path: string, init: RequestInit = {}) {
  const url = getBase() + path
  const res = await fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } })
  return res
}

export async function lookupShipments(orderNumber: string): Promise<SSShipment[]> {
  const r = await ssFetch(`/v2/shipments?external_shipment_id=${encodeURIComponent(orderNumber)}&page_size=5`)
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data.shipments || []) as SSShipment[]
}

export async function tagShipment(shipmentId: string, tagName: string): Promise<boolean> {
  const r = await ssFetch(`/v2/shipments/${shipmentId}/tags/${encodeURIComponent(tagName)}`, { method: 'POST' })
  return r.ok
}

export async function getShipmentLabels(shipmentId: string): Promise<SSLabel[]> {
  const r = await ssFetch(`/v2/labels?shipment_id=${encodeURIComponent(shipmentId)}&page_size=5`)
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data.labels || []) as SSLabel[]
}

// Tracking lives on /labels (per repo memory). Returns first non-voided label or null.
export function firstLiveLabel(labels: SSLabel[]): SSLabel | null {
  for (const l of labels) if (!l.voided_at) return l
  return null
}

export const SS_TAG_NAME = process.env.SS_TAG_NAME || 'Shipping'
