import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
const db = new Database(process.env.DB_FILE || './qcvp.db')
const sql = fs.readFileSync('drizzle/0003_fearless_silver_fox.sql', 'utf-8')
const hash = crypto.createHash('sha256').update(sql).digest('hex')
console.log('Computed hash:', hash)
const r = db.prepare("UPDATE __drizzle_migrations SET hash=? WHERE hash='0003_fearless_silver_fox_manual'").run(hash)
console.log('Updated rows:', r.changes)
