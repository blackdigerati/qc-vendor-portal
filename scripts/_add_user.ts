import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { customAlphabet } from 'nanoid'
import * as schema from '../db/schema'
import { eq } from 'drizzle-orm'

const nano = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 12)

async function main() {
  const email = process.argv[2]?.toLowerCase()
  const role = (process.argv[3] || 'admin') as 'admin' | 'vendor'
  if (!email) { console.error('usage: tsx scripts/_add_user.ts <email> [role]'); process.exit(1) }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:./qcvp.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  const db = drizzle(client, { schema })
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email))
  if (existing.length > 0) {
    console.log(`already exists: ${email} (${existing[0].role})`)
  } else {
    await db.insert(schema.users).values({ id: 'u_' + nano(), email, passwordHash: 'magic-link-only', role })
    console.log(`added ${role}: ${email}`)
  }
  client.close()
}
main().catch(e => { console.error(e); process.exit(1) })
