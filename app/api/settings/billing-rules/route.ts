import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { toCents } from '@/lib/money'
import { upsertBillingRule } from '@/lib/billing-rules-db'
import { writeAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const handlingThresholdCents = toCents(body.threshold)
  const handlingPerItemCents = toCents(body.perItem)
  if (handlingThresholdCents < 0 || handlingPerItemCents < 0) {
    return NextResponse.json({ error: 'Values must be non-negative' }, { status: 400 })
  }
  upsertBillingRule({ handlingThresholdCents, handlingPerItemCents }, s.userId)
  await writeAudit({
    actor: s.userId,
    entityType: 'settings',
    entityId: 'billing-rules',
    action: 'billing_rules.updated',
    payload: { handlingThresholdCents, handlingPerItemCents },
  })
  return NextResponse.json({ ok: true })
}
