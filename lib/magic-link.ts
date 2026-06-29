import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'

const TOKEN_TTL_MIN = 15

function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function appBaseUrl(): string {
  // Vercel exposes the deployed URL via env. Fall back to localhost in dev.
  const fromEnv = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return 'http://localhost:3000'
}

export async function createMagicLinkForEmail(email: string): Promise<string | null> {
  const user = (await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())))[0]
  if (!user) return null
  const token = newToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000)
  await db.insert(schema.magicTokens).values({ token, email: user.email, expiresAt })
  return `${appBaseUrl()}/api/auth/magic/${token}`
}

export async function sendMagicLinkEmail(email: string, link: string): Promise<{ sent: boolean; consoleOnly: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL || 'noreply@example.com'
  const subject = 'Your QC Vendor Portal sign-in link'
  const text = [
    `Click the link below to sign in to the QC Vendor Portal:`,
    ``,
    link,
    ``,
    `This link expires in ${TOKEN_TTL_MIN} minutes and can only be used once.`,
    `If you didn't request this, you can safely ignore the email.`,
  ].join('\n')
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;max-width:540px;margin:0 auto;padding:24px">
      <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">QC Vendor Portal</h1>
      <p style="color:#475569;margin:0 0 20px">Click the button below to sign in.</p>
      <a href="${link}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">Sign in to the portal</a>
      <p style="color:#64748b;font-size:13px;margin-top:24px">This link expires in ${TOKEN_TTL_MIN} minutes and can only be used once. If you didn't request it, ignore this email.</p>
      <p style="color:#94a3b8;font-size:11px;margin-top:16px;word-break:break-all">${link}</p>
    </div>
  `
  if (!apiKey) {
    console.log(`\n[magic-link:console] to=${email}`)
    console.log(`  ${link}\n`)
    return { sent: false, consoleOnly: true }
  }
  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  await resend.emails.send({ from, to: email, subject, text, html })
  return { sent: true, consoleOnly: false }
}

export async function consumeToken(token: string): Promise<{ ok: boolean; email?: string; reason?: string }> {
  const row = (await db.select().from(schema.magicTokens).where(eq(schema.magicTokens.token, token)))[0]
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.usedAt) return { ok: false, reason: 'already used' }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }
  await db.update(schema.magicTokens).set({ usedAt: new Date() }).where(eq(schema.magicTokens.token, token))
  return { ok: true, email: row.email }
}
