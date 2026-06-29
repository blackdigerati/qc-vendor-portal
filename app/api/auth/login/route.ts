import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }
  const user = (await db.select().from(schema.users).where(eq(schema.users.email, String(email).toLowerCase())))[0]
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  const ok = await bcrypt.compare(String(password), user.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  const s = await getSession()
  s.userId = user.id
  s.email = user.email
  s.role = user.role
  await s.save()
  return NextResponse.json({ ok: true, role: user.role })
}
