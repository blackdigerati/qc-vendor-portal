import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
db.pragma('foreign_keys = OFF')
const tx = db.transaction(() => {
  db.exec(`CREATE TABLE IF NOT EXISTS __new_invoices (
    id text PRIMARY KEY NOT NULL,
    batch_id text,
    total_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'open' NOT NULL,
    created_at integer DEFAULT (unixepoch()) NOT NULL,
    description text DEFAULT '' NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`)
  db.exec(`INSERT INTO __new_invoices(id, batch_id, total_cents, status, created_at, description)
    SELECT id, batch_id, total_cents, status, created_at, '' FROM invoices`)
  db.exec(`DROP TABLE invoices`)
  db.exec(`ALTER TABLE __new_invoices RENAME TO invoices`)
  // mark migration as applied
  const row = db.prepare("SELECT * FROM __drizzle_migrations WHERE hash LIKE '%0003%'").get() as any
  if (!row) {
    db.prepare("INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)").run('0003_fearless_silver_fox_manual', Date.now())
  }
})
tx()
db.pragma('foreign_keys = ON')
console.log('Manual schema fix applied. Current invoices schema:')
console.log(db.prepare("PRAGMA table_info(invoices)").all())
