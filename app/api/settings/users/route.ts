import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireAdmin } from '@/lib/auth'
import { customAlphabet } from 'nanoid'
import { writeAudit } from '@/lib/audit'

const nano = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 12)

export async function POST(req: Request) {
  const s = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'vendor'
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const existing = (await db.select().from(schema.users).where(eq(schema.users.email, email)))[0]
  if (existing) return NextResponse.json({ error: `${email} already exists (${existing.role})` }, { status: 409 })

  const id = 'u_' + nano()
  // Passwords are obsolete; store a random hash so the column has a value.
  // (We could drop the column later; keeping it avoids a destructive migration.)
  await db.insert(schema.users).values({
    id,
    email,
    passwordHash: 'magic-link-only',
    role,
  })

  await writeAudit({
    actor: s.userId,
    entityType: 'user',
    entityId: id,
    action: 'user.created',
    payload: { email, role },
  })

  return NextResponse.json({ ok: true, id, email, role })
}

export async function DELETE(req: Request) {
  const s = await requireAdmin()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (id === s.userId) return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })

  const existing = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
  if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await db.delete(schema.users).where(eq(schema.users.id, id))

  await writeAudit({
    actor: s.userId,
    entityType: 'user',
    entityId: id,
    action: 'user.removed',
    payload: { email: existing.email, role: existing.role },
  })

  return NextResponse.json({ ok: true })
}
