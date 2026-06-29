import { NextResponse } from 'next/server'
import { createMagicLinkForEmail, sendMagicLinkEmail } from '@/lib/magic-link'
import { writeAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const link = await createMagicLinkForEmail(email)
  if (link) {
    await sendMagicLinkEmail(email, link)
    await writeAudit({
      actor: undefined,
      entityType: 'auth',
      entityId: email,
      action: 'magic_link.requested',
      payload: { email },
    })
  } else {
    // Email is not in the users table — silently no-op so the response can't
    // be used to enumerate accounts.
    console.log(`[magic-link] request for unknown email "${email}" — ignored`)
  }

  // Always return the same generic response.
  return NextResponse.json({ ok: true })
}
