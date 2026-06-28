import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { parseCsv, parseXlsx, readGoogleSheet, type OrderRow } from '@/lib/orders-source'
import { pullOrders } from '@/lib/orders-pull'
import { sendAlert } from '@/lib/mailer'

export async function POST(req: Request) {
  const s = await requireSession()
  const ct = req.headers.get('content-type') || ''
  let rows: OrderRow[] = []
  let urgentList: string[] = []
  let source: 'sheet' | 'upload' = 'upload'

  try {
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData()
      const file = fd.get('file')
      const urgentText = String(fd.get('urgent_orders') || '')
      urgentList = urgentText.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
      if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      const buf = Buffer.from(await file.arrayBuffer())
      const name = file.name.toLowerCase()
      rows = name.endsWith('.xlsx') || name.endsWith('.xls') ? parseXlsx(buf) : parseCsv(buf)
      source = 'upload'
    } else {
      const body = await req.json().catch(() => ({}))
      if (body.source === 'sheet') {
        const sheetId = body.sheetId || process.env.GOOGLE_SHEET_ID
        const tab = body.tab || process.env.GOOGLE_SHEET_TAB || 'Orders'
        if (!sheetId) return NextResponse.json({ error: 'GOOGLE_SHEET_ID not configured' }, { status: 400 })
        rows = await readGoogleSheet(sheetId, tab)
        urgentList = Array.isArray(body.urgent_orders) ? body.urgent_orders : []
        source = 'sheet'
      } else {
        return NextResponse.json({ error: 'Unsupported request' }, { status: 400 })
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'parse failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await pullOrders(rows, { source, urgentOrderNumbers: urgentList, actor: s.userId })

  if (result.ordersInserted > 0) {
    const lines = [
      `${result.ordersInserted} new orders pulled from ${source}.`,
      `Urgent: ${result.urgentTotal}.`,
      result.skusCreated.length ? `New SKUs added to catalog: ${result.skusCreated.join(', ')}` : '',
    ].filter(Boolean).join('\n')
    await sendAlert('new_orders', `Vendor Portal: ${result.ordersInserted} new orders`, lines)
  }

  return NextResponse.json(result)
}
