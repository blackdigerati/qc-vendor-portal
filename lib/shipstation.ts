type SSShipment = {
  shipment_id: string
  external_shipment_id?: string
  order_number?: string
  shipment_status?: string
  ship_to?: {
    name?: string
    email?: string
    address_line1?: string
    address_line2?: string
    city_locality?: string
    state_province?: string
    postal_code?: string
    country_code?: string
  }
  items?: SSShipmentItem[]
}

export type SSShipmentItem = {
  sku?: string
  name?: string
  quantity?: number
}

export type SSLabel = {
  label_id?: string
  shipment_id?: string
  tracking_number?: string
  tracking_status?: string
  carrier_code?: string
  voided_at?: string | null
  ship_date?: string
  created_at?: string
}

export type ShipToAddress = NonNullable<SSShipment['ship_to']>

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
  return fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } })
}

export async function lookupShipments(orderNumber: string): Promise<SSShipment[]> {
  const r = await ssFetch(`/v2/shipments?external_shipment_id=${encodeURIComponent(orderNumber)}&page_size=5`)
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data.shipments || []) as SSShipment[]
}

export async function lookupShipmentsByEmail(email: string): Promise<SSShipment[]> {
  // SS v2 supports filtering shipments by ship_to_email
  const r = await ssFetch(`/v2/shipments?ship_to_email=${encodeURIComponent(email)}&page_size=10`)
  if (!r.ok) return []
  const data = await r.json().catch(() => ({}))
  return (data.shipments || []) as SSShipment[]
}

export async function getShipment(shipmentId: string): Promise<SSShipment | null> {
  const r = await ssFetch(`/v2/shipments/${encodeURIComponent(shipmentId)}`)
  if (!r.ok) return null
  const data = await r.json().catch(() => null)
  return data as SSShipment | null
}

export async function getShipmentItems(shipmentId: string): Promise<SSShipmentItem[]> {
  const ship = await getShipment(shipmentId)
  return ship?.items ?? []
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

export function firstLiveLabel(labels: SSLabel[]): SSLabel | null {
  for (const l of labels) if (!l.voided_at) return l
  return null
}

/**
 * Pull labels created after a given ISO timestamp. Paginates via page+page_size.
 * Returns only non-voided, completed labels.
 */
export async function listRecentLabels(sinceISO: string, opts: { pageSize?: number; maxPages?: number } = {}): Promise<SSLabel[]> {
  const pageSize = opts.pageSize ?? 100
  const maxPages = opts.maxPages ?? 20
  const all: SSLabel[] = []
  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      created_at_start: sinceISO,
      page: String(page),
      page_size: String(pageSize),
      label_status: 'completed',
    })
    const r = await ssFetch(`/v2/labels?${qs.toString()}`)
    if (!r.ok) break
    const data = await r.json().catch(() => ({}))
    const batch = (data.labels || []) as SSLabel[]
    for (const l of batch) if (!l.voided_at) all.push(l)
    if (batch.length < pageSize) break
  }
  return all
}

/**
 * Update internal notes on a shipment. SS v2 field name is `internal_notes`.
 */
export async function addShipmentNote(shipmentId: string, note: string): Promise<boolean> {
  // SS v2 typically supports PATCH on shipment for select fields.
  const r = await ssFetch(`/v2/shipments/${encodeURIComponent(shipmentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ internal_notes: note }),
  })
  if (r.ok) return true
  // Fallback: PUT some implementations require PUT
  const r2 = await ssFetch(`/v2/shipments/${encodeURIComponent(shipmentId)}`, {
    method: 'PUT',
    body: JSON.stringify({ internal_notes: note }),
  })
  return r2.ok
}

export type MergeResult = {
  ok: boolean
  fallbackUsed: boolean
  detail: string
}

/**
 * Attempt to merge `absorbId` into `keepId` via the SS API.
 *
 * NOTE: SS v2 does not expose a documented public merge endpoint at time of
 * writing. We attempt a best-guess POST path. On any non-2xx response, the
 * caller is expected to fall back to a note + tag workflow.
 */
export async function mergeShipments(keepId: string, absorbId: string): Promise<MergeResult> {
  // Best-effort try — endpoint shape is not officially documented in SS v2.
  try {
    const r = await ssFetch(`/v2/shipments/${encodeURIComponent(keepId)}/merge`, {
      method: 'POST',
      body: JSON.stringify({ shipment_ids: [absorbId] }),
    })
    if (r.ok) return { ok: true, fallbackUsed: false, detail: 'merge api succeeded' }
    return {
      ok: false,
      fallbackUsed: true,
      detail: `merge api returned ${r.status} — caller should fall back to note + tag`,
    }
  } catch (e) {
    return {
      ok: false,
      fallbackUsed: true,
      detail: `merge api threw: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

export const SS_TAG_NAME = process.env.SS_TAG_NAME || 'Shipping'

/** Normalized lowercase address string for diffing two shipments. */
export function normalizeAddress(a: ShipToAddress | undefined | null): string {
  if (!a) return ''
  return [
    a.address_line1,
    a.address_line2,
    a.city_locality,
    a.state_province,
    a.postal_code,
    a.country_code,
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
