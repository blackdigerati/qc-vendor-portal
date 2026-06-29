import { db, schema } from '@/db/client'
import { newId } from './ids'

export async function writeAudit(input: {
  actor?: string
  entityType: string
  entityId: string
  action: string
  payload?: unknown
}) {
  await db.insert(schema.auditLog).values({
    id: newId('al'),
    actor: input.actor,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    payloadJson: JSON.stringify(input.payload ?? {}),
  })
}
