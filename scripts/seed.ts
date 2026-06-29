import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import * as schema from '../db/schema'
import { eq } from 'drizzle-orm'

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@quiltcomfort.com'
const ADMIN_PW = process.env.SEED_ADMIN_PW || 'admin12345'
const VENDOR_EMAIL = process.env.SEED_VENDOR_EMAIL || 'vendor@example.com'
const VENDOR_PW = process.env.SEED_VENDOR_PW || 'vendor12345'

const nano = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 12)

async function main() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./qcvp.db'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const client = createClient({ url, authToken })
  const db = drizzle(client, { schema })

  async function upsertUser(email: string, password: string, role: 'admin' | 'vendor') {
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email))
    if (existing.length > 0) {
      console.log(`  user ${email} already exists (${existing[0].role})`)
      return
    }
    const passwordHash = await bcrypt.hash(password, 10)
    await db.insert(schema.users).values({ id: 'u_' + nano(), email, passwordHash, role })
    console.log(`  created ${role} ${email} (pw: ${password})`)
  }

  console.log('seeding users:')
  await upsertUser(ADMIN_EMAIL, ADMIN_PW, 'admin')
  await upsertUser(VENDOR_EMAIL, VENDOR_PW, 'vendor')

  const ob = await db.select().from(schema.ledgerOpeningBalance)
  if (ob.length === 0) {
    await db.insert(schema.ledgerOpeningBalance).values({ id: 1, amountCents: 0 })
    console.log('  initialized opening balance = $0')
  }
  console.log('seed complete')
  client.close()
}

main().catch(e => { console.error(e); process.exit(1) })
