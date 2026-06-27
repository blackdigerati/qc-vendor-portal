import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const DB_FILE = process.env.DB_FILE || './qcvp.db'
const sqlite = new Database(DB_FILE)
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite)
migrate(db, { migrationsFolder: './drizzle' })
console.log(`migrations applied to ${DB_FILE}`)
sqlite.close()
