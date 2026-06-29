import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

async function main() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./qcvp.db'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const client = createClient({ url, authToken })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log(`migrations applied to ${url}`)
  client.close()
}

main().catch(e => { console.error(e); process.exit(1) })
