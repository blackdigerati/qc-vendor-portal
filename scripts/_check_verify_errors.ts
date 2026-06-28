import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
const rows = db.prepare("SELECT order_number, ss_verify_status, ss_verify_error FROM orders WHERE ss_verify_status='error' LIMIT 5").all()
console.log('Errors:')
for (const r of rows) console.log(JSON.stringify(r, null, 2))
