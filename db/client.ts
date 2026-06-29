import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

declare global {
  // eslint-disable-next-line no-var
  var __qcvp_db: Db | undefined
}

function getInstance(): Db {
  if (global.__qcvp_db) return global.__qcvp_db
  // Supports both:
  //   - Local dev: TURSO_DATABASE_URL=file:./qcvp.db
  //   - Production: TURSO_DATABASE_URL=libsql://<your-db>.turso.io + TURSO_AUTH_TOKEN=<token>
  // Falls back to a local file so existing local dev keeps working unchanged.
  const url = process.env.TURSO_DATABASE_URL || 'file:./qcvp.db'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const client = createClient({ url, authToken })
  const d = drizzle(client, { schema }) as Db
  global.__qcvp_db = d
  return d
}

// Lazy proxy — DB is not connected until a method is actually called.
export const db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = getInstance() as unknown as Record<string | symbol, unknown>
    const v = real[prop as string]
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(real) : v
  },
})

export { schema }
