import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { lookupShipments, lookupShipmentsByEmail } from '@/lib/shipstation'
import { writeAudit } from '@/lib/audit'

type Body = {
  orderNumbers?: string[]   // optional explicit list; default = all unverified queued/partial
  forceReverify?: boolean   // re-check already-verified rows
}

export async function POST(req: Request) {
  const s = await requireSession()
  const body = (await req.json().catch(() => ({}))) as Body

  let toCheck = await db.select().from(schema.orders).where(
    inArray(schema.orders.status, ['queued', 'partial']),
  )

  if (body.orderNumbers && body.orderNumbers.length > 0) {
    const set = new Set(body.orderNumbers)
    toCheck = toCheck.filter(o => set.has(o.orderNumber))
  } else if (!body.forceReverify) {
    toCheck = toCheck.filter(o => o.ssVerifyStatus === 'unverified' || o.ssVerifyStatus === 'error')
  }

  let verified = 0, emailMatched = 0, notFound = 0, errors = 0
  const now = new Date()

  for (const o of toCheck) {
    try {
      const ships = await lookupShipments(o.orderNumber)
      if (ships.length > 0 && ships[0].shipment_id) {
        await db.update(schema.orders).set({
          ssVerifyStatus: 'verified',
          ssShipmentId: ships[0].shipment_id,
          ssVerifyCheckedAt: now,
          ssVerifyError: null,
        }).where(eq(schema.orders.orderNumber, o.orderNumber))
        verified++
        continue
      }
      // Fallback by email
      const byEmail = o.email ? await lookupShipmentsByEmail(o.email) : []
      if (byEmail.length > 0 && byEmail[0].shipment_id) {
        await db.update(schema.orders).set({
          ssVerifyStatus: 'email_matched',
          ssShipmentId: byEmail[0].shipment_id,
          ssVerifyCheckedAt: now,
          ssVerifyError: `Found via email (${byEmail.length} match${byEmail.length === 1 ? '' : 'es'})`,
        }).where(eq(schema.orders.orderNumber, o.orderNumber))
        emailMatched++
        continue
      }
      await db.update(schema.orders).set({
        ssVerifyStatus: 'not_found',
        ssShipmentId: null,
        ssVerifyCheckedAt: now,
        ssVerifyError: null,
      }).where(eq(schema.orders.orderNumber, o.orderNumber))
      notFound++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await db.update(schema.orders).set({
        ssVerifyStatus: 'error',
        ssVerifyCheckedAt: now,
        ssVerifyError: msg.slice(0, 500),
      }).where(eq(schema.orders.orderNumber, o.orderNumber))
      errors++
    }
  }

  await writeAudit({
    actor: s.userId,
    entityType: 'verify_run',
    entityId: now.toISOString(),
    action: 'orders.ss_verified',
    payload: { checked: toCheck.length, verified, emailMatched, notFound, errors, forceReverify: !!body.forceReverify },
  })

  return NextResponse.json({
    checked: toCheck.length,
    verified,
    emailMatched,
    notFound,
    errors,
  })
}
