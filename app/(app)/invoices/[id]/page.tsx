import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { fromCents } from '@/lib/money'
import { invoiceOpenBalance } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

function statusPill(s: string) {
  const map: Record<string, string> = {
    open: 'bg-amber-100 text-amber-900 border border-amber-300',
    partial: 'bg-blue-100 text-blue-900 border border-blue-300',
    paid: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
  }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${map[s] || 'bg-slate-200 text-slate-800'}`}>{s}</span>
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = (await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)))[0]
  if (!invoice) notFound()

  const lines = await db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, id))
  const allocs = await db.select().from(schema.paymentAllocations).where(eq(schema.paymentAllocations.invoiceId, id))
  const payIds = [...new Set(allocs.map(a => a.paymentId))]
  const payments = payIds.length
    ? (await db.select().from(schema.payments)).filter(p => payIds.includes(p.id))
    : []
  const payMap = new Map(payments.map(p => [p.id, p]))

  const openCents = await invoiceOpenBalance(id)
  const paidCents = invoice.totalCents - openCents

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-mono">{invoice.id}</h1>
          <div className="text-[13px] text-slate-600 mt-0.5 flex items-center gap-2">
            <span>Created {new Date(invoice.createdAt).toLocaleString()}</span>
            <span className="text-slate-400">·</span>
            {invoice.batchId ? (
              <Link href={`/batches/${invoice.batchId}`} className="font-mono text-slate-700 hover:text-emerald-700 hover:underline">{invoice.batchId}</Link>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-200 text-slate-700">Manual</span>
            )}
            <span className="text-slate-400">·</span>
            {statusPill(invoice.status)}
          </div>
          {invoice.description && (
            <p className="text-[13px] text-slate-700 mt-1 italic">“{invoice.description}”</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total</div>
          <div className="text-2xl font-bold tabular-nums text-slate-900">{fromCents(invoice.totalCents)}</div>
          <div className="text-[12px] text-slate-600 mt-0.5">
            Paid <span className="font-medium tabular-nums">{fromCents(paidCents)}</span> · Open{' '}
            <span className={`font-semibold tabular-nums ${openCents > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fromCents(openCents)}</span>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-600">Lines</header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-40">SKU</th>
              <th className="px-3 py-2 text-right font-semibold w-14">Qty</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Unit cost</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Handling/ea</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No lines.</td></tr>
            )}
            {lines.map(l => (
              <tr key={l.id} className="border-t border-slate-200">
                <td className="px-3 py-1.5 font-mono text-[12px]">{l.sku || <span className="text-slate-400">no-sku</span>}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.qty}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fromCents(l.unitCostCents)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.shippingAddonCents > 0 ? fromCents(l.shippingAddonCents) : <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fromCents(l.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400">
                <td colSpan={4} className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[11px] text-slate-700">Invoice total</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{fromCents(invoice.totalCents)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-600 flex items-center justify-between">
          <span>Payments applied</span>
          <span className="text-slate-500">{allocs.length}</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-28">Paid on</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Ref</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Applied</th>
            </tr>
          </thead>
          <tbody>
            {allocs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No payments applied yet.</td></tr>
            )}
            {allocs.map(a => {
              const p = payMap.get(a.paymentId)
              return (
                <tr key={a.id} className="border-t border-slate-200">
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">{p?.paidOn.toLocaleDateString() ?? '—'}</td>
                  <td className="px-3 py-1.5 text-[12px]">{p?.status ?? '—'}</td>
                  <td className="px-3 py-1.5">{p?.refNote || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fromCents(a.amountCents)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
