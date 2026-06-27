import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

declare global {
  // eslint-disable-next-line no-var
  var __qcvp_db: Db | undefined
}

function getInstance(): Db {
  if (global.__qcvp_db) return global.__qcvp_db
  const file = process.env.DB_FILE || './qcvp.db'
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  const d = drizzle(sqlite, { schema }) as Db
  global.__qcvp_db = d
  return d
}

// Lazy proxy — DB is not opened until a method is actually called.
// This keeps Next's "collect page data" build step from hitting SQLITE_BUSY
// when 15 workers import this module in parallel.
export const db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = getInstance() as unknown as Record<string | symbol, unknown>
    const v = real[prop as string]
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(real) : v
  },
})

export { schema }
