import * as XLSX from 'xlsx'
import { google } from 'googleapis'
import { toCents } from './money'

export type OrderRow = {
  orderNumber: string
  email: string
  firstName: string
  lastName: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  country: string
  name: string
  qty: number
  costOfGoodsCents: number
  notes: string
  sku: string
}

// Canonical 15-col Filtered CSV header. Tolerant matcher below normalizes case/spacing.
const COL_KEYS = [
  'order number',
  'email (billing)',
  'first name (shipping)',
  'last name (shipping)',
  'address 1 (shipping)',
  'address 2 (shipping)',
  'city (shipping)',
  'state (shipping)',
  'zip (shipping)',
  'country code (shipping)',
  'name',
  'quantity',
  'cost of goods',
  'order notes',
  'sku',
] as const

function norm(s: string) {
  return String(s ?? '').replace(/^﻿/, '').trim().toLowerCase()
}

function buildIndex(header: string[]): Record<(typeof COL_KEYS)[number], number> {
  const idx = {} as Record<(typeof COL_KEYS)[number], number>
  const map = new Map<string, number>()
  header.forEach((h, i) => map.set(norm(h), i))
  for (const k of COL_KEYS) {
    const i = map.get(k)
    if (i === undefined) throw new Error(`Missing required column: "${k}". Got headers: ${header.join(', ')}`)
    idx[k] = i
  }
  return idx
}

function rowsToOrders(rows: string[][]): OrderRow[] {
  if (rows.length === 0) return []
  const header = rows[0]
  const idx = buildIndex(header)
  const out: OrderRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every(c => !c || !String(c).trim())) continue
    const get = (k: (typeof COL_KEYS)[number]) => String(row[idx[k]] ?? '').trim()
    const orderNumber = get('order number')
    if (!orderNumber) continue
    out.push({
      orderNumber,
      email: get('email (billing)').toLowerCase(),
      firstName: get('first name (shipping)'),
      lastName: get('last name (shipping)'),
      address1: get('address 1 (shipping)'),
      address2: get('address 2 (shipping)'),
      city: get('city (shipping)'),
      state: get('state (shipping)'),
      zip: get('zip (shipping)'),
      country: get('country code (shipping)'),
      name: get('name'),
      qty: parseInt(get('quantity') || '1', 10) || 1,
      costOfGoodsCents: toCents(get('cost of goods')),
      notes: get('order notes'),
      sku: get('sku'),
    })
  }
  return out
}

export function parseCsv(buf: Buffer | string): OrderRow[] {
  const text = typeof buf === 'string' ? buf : buf.toString('utf-8')
  const wb = XLSX.read(text, { type: 'string', raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
  return rowsToOrders(rows)
}

export function parseXlsx(buf: Buffer): OrderRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
  return rowsToOrders(rows)
}

export async function readGoogleSheet(sheetId: string, tab: string): Promise<OrderRow[]> {
  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (credPath) {
    // Service-account path (private sheets)
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tab,
      valueRenderOption: 'UNFORMATTED_VALUE',
    })
    const rows = (resp.data.values || []) as string[][]
    return rowsToOrders(rows.map(r => r.map(c => (c === undefined || c === null ? '' : String(c)))))
  }

  // Fallback: public CSV export. Requires the sheet to be "Anyone with the link → Viewer".
  // Uses gviz so a tab name (or gid) works, vs the /export?format=csv that only takes gid.
  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) {
    throw new Error(`Public sheet fetch failed (${r.status}). Make sure the sheet is shared "Anyone with the link → Viewer", or set GOOGLE_SERVICE_ACCOUNT_JSON for private sheets.`)
  }
  const text = await r.text()
  if (text.trim().startsWith('<')) {
    // Google returned an HTML error page (e.g. login wall) instead of CSV.
    throw new Error('Google returned HTML instead of CSV — the sheet probably isn\'t public. Share it as "Anyone with the link → Viewer".')
  }
  return parseCsv(text)
}

export function detectUrgent(notes: string): boolean {
  return /\burgent\b/i.test(notes)
}
