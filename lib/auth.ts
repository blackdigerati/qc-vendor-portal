import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession, SessionOptions } from 'iron-session'

export type SessionData = {
  userId?: string
  email?: string
  role?: 'vendor' | 'admin'
}

const SECRET = process.env.SESSION_SECRET
if (!SECRET || SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.warn('[auth] SESSION_SECRET missing or <32 chars; cookies will not be secure')
}

const SESSION_TTL_SECONDS = 15 * 24 * 60 * 60 // 15 days

export const sessionOptions: SessionOptions = {
  password: SECRET || 'dev-only-insecure-placeholder-secret-32xxxxxx',
  cookieName: 'qcvp_session',
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  },
}

export async function getSession() {
  const c = await cookies()
  return getIronSession<SessionData>(c, sessionOptions)
}

export async function requireSession() {
  const s = await getSession()
  if (!s.userId) redirect('/login')
  return s as Required<Pick<SessionData, 'userId' | 'email' | 'role'>>
}

export async function requireAdmin() {
  const s = await requireSession()
  if (s.role !== 'admin') redirect('/queue')
  return s
}
