import { asc } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { getSession } from '@/lib/auth'
import { UsersEditor, type UserRow } from './users-editor'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const session = await getSession()
  const rows = await db.select().from(schema.users).orderBy(asc(schema.users.email))
  const data: UserRow[] = rows.map(r => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt.toISOString(),
    isSelf: r.id === session.userId,
  }))
  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Only emails on this list can sign in. Add the vendor + anyone else who needs access. Users sign in via a magic link
        sent to their email — no passwords. Remove a user to revoke access immediately.
      </p>
      <UsersEditor initial={data} />
    </div>
  )
}
