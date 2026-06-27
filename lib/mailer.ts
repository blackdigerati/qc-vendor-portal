import { db, schema } from '@/db/client'
import { eq } from 'drizzle-orm'

type EventType = 'new_orders' | 'new_invoice'

export async function sendAlert(eventType: EventType, subject: string, body: string) {
  const recipients = db
    .select({ email: schema.alertRecipients.email })
    .from(schema.alertRecipients)
    .where(eq(schema.alertRecipients.eventType, eventType))
    .all()
    .map(r => r.email)

  if (recipients.length === 0) {
    console.log(`[mailer] no recipients for ${eventType} — skipped`)
    return { sent: 0 }
  }

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL || 'no-reply@example.com',
      to: recipients,
      subject,
      text: body,
    })
    console.log(`[mailer] sent ${eventType} to ${recipients.length} via Resend`)
  } else {
    console.log(`\n[mailer:console] event=${eventType}`)
    console.log(`  to: ${recipients.join(', ')}`)
    console.log(`  subject: ${subject}`)
    console.log(`  body:\n${body}\n`)
  }
  return { sent: recipients.length }
}
