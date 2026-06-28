'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fromCents } from '@/lib/money'

export type BatchLine = {
  orderItemId: string
  orderNumber: string
  urgent: boolean
  sku: string
  name: string
  qty: number
  baseCost: string      // dollars, two decimals
  shippingAddon: string
  skuInDb: boolean
}

export function BatchLineEditor({
  batchId,
  initialLines,
  invoiceId,
  invoiceTotalCents,
}: {
  batchId: string
  initialLines: BatchLine[]
  invoiceId: string | null
  invoiceTotalCents: number | null
}) {
  const router = useRouter()
  const [lines, setLines] = useState<BatchLine[]>(initialLines)
  const [savingSku, setSavingSku] = useState<string | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  const grouped = useMemo(() => {
    const m = new Map<string, BatchLine[]>()
    for (const l of lines) {
      const list = m.get(l.orderNumber) || []
      list.push(l)
      m.set(l.orderNumber, list)
    }
    return [...m.entries()]
  }, [lines])

  function totalForLine(l: BatchLine): number {
    const c = parseFloat(l.baseCost) || 0
    const s = parseFloat(l.shippingAddon) || 0
    return Math.round((c + s) * l.qty * 100)
  }

  const grandTotalCents = useMemo(
    () => lines.reduce((acc, l) => acc + totalForLine(l), 0),
    [lines],
  )

  function patchLine(orderItemId: string, fields: Partial<BatchLine>) {
    setLines(lines.map(l => (l.orderItemId === orderItemId ? { ...l, ...fields } : l)))
  }

  async function saveSku(line: BatchLine) {
    if (!line.sku) {
      toast.error('Cannot save: SKU is blank on this line')
      return
    }
    setSavingSku(line.sku)
    const r = await fetch(`/api/skus/${encodeURIComponent(line.sku)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseCost: line.baseCost,
        shippingAddon: line.shippingAddon,
        description: line.name,
      }),
    })
    setSavingSku(null)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Save failed' }))
      toast.error(error || `SKU ${line.sku} save failed`)
      return
    }
    // Mirror the saved values to any other lines with the same SKU
    setLines(prev =>
      prev.map(l =>
        l.sku === line.sku
          ? { ...l, baseCost: line.baseCost, shippingAddon: line.shippingAddon, skuInDb: true }
          : l,
      ),
    )
    toast.success(`Saved pricing for ${line.sku}`)
  }

  async function createInvoice() {
    setCreatingInvoice(true)
    const r = await fetch(`/api/batches/${batchId}/create-invoice`, { method: 'POST' })
    setCreatingInvoice(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Create invoice failed' }))
      toast.error(error || 'Create invoice failed')
      return
    }
    const d = await r.json()
    toast.success(
      `Invoice ${d.invoiceId} created — ${fromCents(d.totalCents)}` +
      (d.warnings?.length ? ` (${d.warnings.length} warning${d.warnings.length === 1 ? '' : 's'})` : ''),
    )
    router.refresh()
  }

  const isInvoiced = !!invoiceId
  const readOnly = isInvoiced

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-36">Order / SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold w-14">Qty</th>
              <th className="px-3 py-2 text-right font-semibold w-28">COG</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Shipping</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Line Total</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([orderNumber, orderLines]) => {
              const orderTotal = orderLines.reduce((acc, l) => acc + totalForLine(l), 0)
              const urgent = orderLines[0]?.urgent
              return (
                <Fragment key={orderNumber}>
                  <tr className={`border-t-2 border-slate-400 bg-slate-200 ${urgent ? 'border-l-4 border-l-red-600' : ''}`}>
                    <td colSpan={5} className="px-3 py-1.5 font-mono font-semibold text-slate-900">
                      #{orderNumber}
                      {urgent && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                          URG
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(orderTotal)}</td>
                    <td></td>
                  </tr>
                  {orderLines.map(l => {
                    const dirty = false // future: track per-line dirty
                    const t = totalForLine(l)
                    return (
                      <tr key={l.orderItemId} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                        <td className="px-3 py-1 font-mono text-[11px] text-slate-500 pl-8">{l.sku || <span className="text-slate-400">no-sku</span>}</td>
                        <td className="px-3 py-1 text-slate-700">
                          {l.name}
                          {!l.skuInDb && l.sku && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300 align-middle">
                              NEW SKU
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums">{l.qty}</td>
                        <td className="px-3 py-1 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.baseCost}
                            disabled={readOnly}
                            onChange={e => patchLine(l.orderItemId, { baseCost: e.target.value })}
                            onBlur={() => !readOnly && saveSku(l)}
                            className="h-7 text-right tabular-nums w-24 inline-block"
                          />
                        </td>
                        <td className="px-3 py-1 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.shippingAddon}
                            disabled={readOnly}
                            onChange={e => patchLine(l.orderItemId, { shippingAddon: e.target.value })}
                            onBlur={() => !readOnly && saveSku(l)}
                            className="h-7 text-right tabular-nums w-24 inline-block"
                          />
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums font-medium">{fromCents(t)}</td>
                        <td className="px-3 py-1 text-right text-[11px] text-slate-400">
                          {savingSku === l.sku ? 'saving…' : dirty ? 'unsaved' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {lines.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">This batch has no shipped items.</td></tr>
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400">
                <td colSpan={5} className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-[11px] text-slate-700">Batch total</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{fromCents(grandTotalCents)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center justify-between bg-white border border-slate-300 rounded-md shadow-sm px-3 py-2">
        <div className="text-[13px] text-slate-600">
          {isInvoiced ? (
            <>Invoice <span className="font-mono font-semibold text-slate-900">{invoiceId}</span> already issued for {fromCents(invoiceTotalCents ?? 0)} — pricing locked.</>
          ) : (
            <>Edit COG + Shipping per line above (changes save to the SKU DB on blur). Then create the invoice.</>
          )}
        </div>
        {!isInvoiced && (
          <Button onClick={createInvoice} disabled={creatingInvoice || lines.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {creatingInvoice ? 'Creating…' : `Create Invoice — ${fromCents(grandTotalCents)}`}
          </Button>
        )}
      </div>
    </div>
  )
}
