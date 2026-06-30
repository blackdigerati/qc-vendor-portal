import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../db/schema'
import { eq, desc } from 'drizzle-orm'

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:./qcvp.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  const db = drizzle(client, { schema })

  // Find the most recent payment (likely the $1050 the user just made)
  const recent = await db.select().from(schema.payments).orderBy(desc(schema.payments.recordedAt)).limit(5)
  console.log('Most recent payments:')
  for (const p of recent) {
    console.log(`  ${p.id}  ${p.amountCents/100}  ${p.status}  paidOn=${p.paidOn.toISOString().slice(0,10)}  ref="${p.refNote}"`)
  }

  const target = recent.find(p => p.amountCents === 105000) || recent[0]
  if (!target) { console.log('No payments found'); return }
  console.log(`\nDeleting payment ${target.id} ($${target.amountCents/100}, ${target.status})...`)

  // Find affected invoices to recompute their status after
  const allocs = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, target.id))
  const affectedInvoiceIds = [...new Set(allocs.map(a => a.invoiceId))]
  console.log(`  ${allocs.length} allocations across ${affectedInvoiceIds.length} invoice(s) will be removed`)

  await db.delete(schema.paymentAllocations).where(eq(schema.paymentAllocations.paymentId, target.id))
  await db.delete(schema.payments).where(eq(schema.payments.id, target.id))

  // Recompute invoice statuses
  for (const invId of affectedInvoiceIds) {
    const inv = (await db.select().from(schema.invoices).where(eq(schema.invoices.id, invId)))[0]
    if (!inv) continue
    const remainingAllocs = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.invoiceId, invId))
    // Sum only those tied to received/approved payments
    let allocated = 0
    for (const a of remainingAllocs) {
      const p = (await db.select().from(schema.payments).where(eq(schema.payments.id, a.paymentId)))[0]
      if (p && (p.status === 'received' || p.status === 'approved')) allocated += a.amountCents
    }
    const newStatus = allocated >= inv.totalCents ? 'paid' : allocated > 0 ? 'partial' : 'open'
    await db.update(schema.invoices).set({ status: newStatus }).where(eq(schema.invoices.id, invId))
    console.log(`  invoice ${invId}: ${allocated/100} allocated → status=${newStatus}`)
  }

  console.log('\nDone.')
  client.close()
}
main().catch(e => { console.error(e); process.exit(1) })
