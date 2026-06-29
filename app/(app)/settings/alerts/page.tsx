import { db, schema } from '@/db/client'
import { AlertsEditor, type AlertRow } from './alerts-editor'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const rows = await db.select().from(schema.alertRecipients)
  const data: AlertRow[] = rows.map(r => ({ id: r.id, email: r.email, eventType: r.eventType }))
  return <AlertsEditor initial={data} />
}
