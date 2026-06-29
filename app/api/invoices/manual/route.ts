import { NextResponse } from 'next/server'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { newId } from '@/lib/ids'
import { writeAudit } from '@/lib/audit'
import { sendAlert } from '@/lib/mailer'
import { fromCents } from '@/lib/money'

type LineInput = {
  sku?: string
  name?: string
  qty: string | number
  unitCost: string | number
  handlingPerItem?: string | number
}

type Body = {
  description: string
  lines: LineInput[]
}

async function nextInvoiceId(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const ids = (await db.select({ id: schema.invoices.id }).from(schema.invoices)).map(r => r.id)
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = parseInt(id.slice(prefix.length), 10)
    if (n > max) max = n
  }
  return prefix + String(max + 1).padStart(4, '0')
}

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  const description = String(body.description ?? '').trim().slice(0, 500)
  const linesIn = Array.isArray(body.lines) ? body.lines : []
  if (linesIn.length === 0) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 })

  const invoiceId = await nextInvoiceId()
  let total = 0
  const lines: (typeof schema.invoiceLines.$inferInsert)[] = []

  for (const l of linesIn) {
    const qty = Math.max(1, parseInt(String(l.qty || '1'), 10) || 1)
    const unitCostCents = toCents(l.unitCost)
    const handlingCents = toCents(l.handlingPerItem ?? 0)
    const sku = String(l.sku || '').trim() || 'MANUAL'
    if (unitCostCents <= 0 && handlingCents <= 0) continue
    const lineTotal = (unitCostCents + handlingCents) * qty
    total += lineTotal
    lines.push({
      id: newId('il'),
      invoiceId,
      sku,
      qty,
      unitCostCents,
      shippingAddonCents: handlingCents,
      lineTotalCents: lineTotal,
    })
  }
  if (lines.length === 0) return NextResponse.json({ error: 'No lines have a charge' }, { status: 400 })

  await db.insert(schema.invoices).values({
    id: invoiceId,
    batchId: null,
    totalCents: total,
    status: 'open',
    description,
  })
  for (const ln of lines) await db.insert(schema.invoiceLines).values(ln)

  await writeAudit({
    actor: s.userId,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'invoice.manual_created',
    payload: { description, totalCents: total, lineCount: lines.length },
  })

  await sendAlert(
    'new_invoice',
    `Vendor Portal: manual invoice ${invoiceId} — ${fromCents(total)}`,
    [
      `Manual invoice ${invoiceId} issued.`,
      description ? `Description: ${description}` : '',
      `Total: ${fromCents(total)}.`,
    ].filter(Boolean).join('\n'),
  )

  return NextResponse.json({ ok: true, invoiceId, totalCents: total })
}
