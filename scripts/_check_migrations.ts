import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
console.log(db.prepare('SELECT * FROM __drizzle_migrations').all())
