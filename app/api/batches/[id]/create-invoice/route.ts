import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { requireSession } from '@/lib/auth'
import { createInvoiceForBatch } from '@/lib/invoice'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id } = await params

  const batch = (await db.select().from(schema.batches).where(eq(schema.batches.id, id)))[0]
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.invoiceId) return NextResponse.json({ error: `Batch already has invoice ${batch.invoiceId}` }, { status: 409 })

  const result = await createInvoiceForBatch(id, s.userId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json(result)
}
