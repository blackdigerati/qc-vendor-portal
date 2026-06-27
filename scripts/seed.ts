import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import * as schema from '../db/schema'
import { eq } from 'drizzle-orm'

const DB_FILE = process.env.DB_FILE || './qcvp.db'
const sqlite = new Database(DB_FILE)
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })
const nano = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 12)

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@quiltcomfort.com'
const ADMIN_PW = process.env.SEED_ADMIN_PW || 'admin12345'
const VENDOR_EMAIL = process.env.SEED_VENDOR_EMAIL || 'vendor@example.com'
const VENDOR_PW = process.env.SEED_VENDOR_PW || 'vendor12345'

async function upsertUser(email: string, password: string, role: 'admin' | 'vendor') {
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get()
  if (existing) {
    console.log(`  user ${email} already exists (${existing.role})`)
    return
  }
  const passwordHash = await bcrypt.hash(password, 10)
  db.insert(schema.users).values({ id: 'u_' + nano(), email, passwordHash, role }).run()
  console.log(`  created ${role} ${email} (pw: ${password})`)
}

async function main() {
  console.log('seeding users:')
  await upsertUser(ADMIN_EMAIL, ADMIN_PW, 'admin')
  await upsertUser(VENDOR_EMAIL, VENDOR_PW, 'vendor')

  // ensure singleton opening balance row exists
  const ob = db.select().from(schema.ledgerOpeningBalance).get()
  if (!ob) {
    db.insert(schema.ledgerOpeningBalance).values({ id: 1, amountCents: 0 }).run()
    console.log('  initialized opening balance = $0')
  }
  console.log('seed complete')
}

main().then(() => sqlite.close())
