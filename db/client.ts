import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DB_FILE = process.env.DB_FILE || './qcvp.db'

declare global {
  // eslint-disable-next-line no-var
  var __qcvp_db: ReturnType<typeof drizzle> | undefined
  // eslint-disable-next-line no-var
  var __qcvp_sqlite: Database.Database | undefined
}

function init() {
  const sqlite = new Database(DB_FILE)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return { sqlite, db: drizzle(sqlite, { schema }) }
}

let db: ReturnType<typeof drizzle>

if (process.env.NODE_ENV === 'production') {
  db = init().db
} else {
  if (!global.__qcvp_db) {
    const { sqlite, db: d } = init()
    global.__qcvp_sqlite = sqlite
    global.__qcvp_db = d
  }
  db = global.__qcvp_db!
}

export { db, schema }
