import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { consumeToken } from '@/lib/magic-link'
import { getSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const url = new URL(req.url)

  const r = await consumeToken(token)
  if (!r.ok) {
    const dest = new URL('/login', url.origin)
    dest.searchParams.set('error', r.reason || 'invalid')
    return NextResponse.redirect(dest)
  }

  const user = (await db.select().from(schema.users).where(eq(schema.users.email, r.email!.toLowerCase())))[0]
  if (!user) {
    const dest = new URL('/login', url.origin)
    dest.searchParams.set('error', 'user_removed')
    return NextResponse.redirect(dest)
  }

  const s = await getSession()
  s.userId = user.id
  s.email = user.email
  s.role = user.role
  await s.save()

  await writeAudit({
    actor: user.id,
    entityType: 'auth',
    entityId: user.email,
    action: 'magic_link.signed_in',
    payload: {},
  })

  return NextResponse.redirect(new URL('/queue', url.origin))
}
