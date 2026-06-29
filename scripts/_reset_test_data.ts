// Wipe all transactional data for a clean test run.
// Keeps: users, ledger_opening_balance, alert_recipients, billing_settings.
// Wipes: orders, order_items, batches, invoices, invoice_lines, payments,
//        payment_allocations, skus, ss_sync_cursor, audit_log, returns,
//        magic_tokens.
//
// Works against Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN) or local file.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@libsql/client'

async function main() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./qcvp.db'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const db = createClient({ url, authToken })

  console.log(`Resetting data on: ${url}`)

  // Turn FKs OFF — circular FK between batches.invoice_id and invoices.batch_id
  await db.execute('PRAGMA foreign_keys = OFF')

  const tables = [
    'payment_allocations',
    'payments',
    'invoice_lines',
    'invoices',
    'order_items',
    'batches',
    'orders',
    'skus',
    'ss_sync_cursor',
    'audit_log',
    'returns',
    'magic_tokens',
  ]
  const counts: Record<string, number> = {}

  for (const t of tables) {
    try {
      const r = await db.execute(`DELETE FROM ${t}`)
      counts[t] = Number(r.rowsAffected ?? 0)
    } catch (e) {
      counts[t] = -1
      console.warn(`  (skipped ${t}: ${e instanceof Error ? e.message : String(e)})`)
    }
  }

  await db.execute('PRAGMA foreign_keys = ON')

  console.log('Reset complete:')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`)
  console.log('Kept: users, ledger_opening_balance, alert_recipients, billing_settings')
  db.close()
}

main().catch(e => { console.error(e); process.exit(1) })
