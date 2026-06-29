'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { fromCents } from '@/lib/money'
import { computeHandlingPerItem, type BillingRule } from '@/lib/billing-rules'

export type BatchLine = {
  orderItemId: string
  orderNumber: string
  urgent: boolean
  sku: string
  name: string
  qty: number
  baseCost: string      // dollars, two decimals (editable)
  skuInDb: boolean
  mergedFromOrderNumber: string | null
}

function EditLineMenu({ batchId, line }: { batchId: string; line: BatchLine }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'reduce' | 'remove'>(line.qty > 1 ? 'reduce' : 'remove')
  const [newQty, setNewQty] = useState(String(Math.max(1, line.qty - 1)))
  const [reason, setReason] = useState('')
  const [bounceBack, setBounceBack] = useState(true)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    let body: Record<string, unknown>
    if (mode === 'reduce') {
      const n = parseInt(newQty, 10)
      if (!n || n < 1 || n >= line.qty) {
        toast.error(`Qty must be between 1 and ${line.qty - 1}`)
        setBusy(false)
        return
      }
      body = { action: 'reduce_qty', qty: n, reason }
    } else {
      body = { action: 'remove', reason, bounceToQueue: bounceBack }
    }
    const r = await fetch(`/api/batches/${batchId}/items/${line.orderItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Edit failed' }))
      toast.error(error || 'Edit failed')
      return
    }
    const d = await r.json()
    if (mode === 'reduce') {
      toast.success(`Qty ${line.qty} → ${d.newQty} · ${d.bouncedQty} bounced back to queue`)
    } else {
      toast.success(d.bouncedToQueue ? 'Item bounced back to queue' : 'Item cancelled')
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-slate-500 hover:text-emerald-700 underline"
        title="Reduce qty or remove from this batch (because it wasn't actually shipped)"
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit batch line</DialogTitle>
            <DialogDescription>
              Use this if the label was printed but the item didn&apos;t actually ship (out-of-stock at pack time, etc.).
              The remainder bounces back to the queue so it can ship later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[13px]">
            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              <div className="font-mono text-[12px] text-slate-500">{line.sku || 'no-sku'}</div>
              <div className="text-slate-900">{line.name}</div>
              <div className="text-[12px] text-slate-600 mt-0.5">Order #{line.orderNumber} · qty {line.qty}</div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('reduce')}
                disabled={line.qty <= 1}
                className={`flex-1 text-[12px] py-1.5 rounded border ${mode === 'reduce' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                Reduce qty
              </button>
              <button
                type="button"
                onClick={() => setMode('remove')}
                className={`flex-1 text-[12px] py-1.5 rounded border ${mode === 'remove' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
              >
                Remove line
              </button>
            </div>

            {mode === 'reduce' ? (
              <div>
                <Label htmlFor="nq">New qty (was {line.qty})</Label>
                <Input id="nq" type="number" min={1} max={line.qty - 1} value={newQty} onChange={e => setNewQty(e.target.value)} className="tabular-nums" />
                <p className="text-[11px] text-slate-500 mt-1">
                  Difference ({Math.max(0, line.qty - (parseInt(newQty, 10) || 0))}) bounces back to the queue as a pending item on order #{line.orderNumber}.
                </p>
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={bounceBack} onChange={e => setBounceBack(e.target.checked)} />
                  Bounce back to queue (will ship in a later batch). Uncheck to cancel the item entirely.
                </label>
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. out of stock at pack time, wrong item, damaged" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className={mode === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}>
              {busy ? 'Saving…' : mode === 'remove' ? 'Remove' : 'Reduce'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BatchLineEditor({
  batchId,
  initialLines,
  invoiceId,
  invoiceTotalCents,
  isAdmin,
  mergedFromByOrder,
  billingRule,
}: {
  batchId: string
  initialLines: BatchLine[]
  invoiceId: string | null
  invoiceTotalCents: number | null
  isAdmin: boolean
  mergedFromByOrder: Record<string, string[]>
  billingRule: BillingRule
}) {
  const router = useRouter()
  const [lines, setLines] = useState<BatchLine[]>(initialLines)
  const [savingSku, setSavingSku] = useState<string | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteInvoice() {
    if (!invoiceId) return
    if (!confirm(`Delete invoice ${invoiceId} and reopen the batch? Pricing will be re-evaluated when you recreate the invoice.`)) return
    setDeleting(true)
    const r = await fetch(`/api/batches/${batchId}/invoice`, { method: 'DELETE' })
    setDeleting(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Delete failed' }))
      toast.error(error || 'Delete failed')
      return
    }
    toast.success(`Invoice ${invoiceId} deleted — batch reopened`)
    router.refresh()
  }

  const grouped = useMemo(() => {
    const m = new Map<string, BatchLine[]>()
    for (const l of lines) {
      const list = m.get(l.orderNumber) || []
      list.push(l)
      m.set(l.orderNumber, list)
    }
    return [...m.entries()]
  }, [lines])

  function lineNumbers(l: BatchLine) {
    const cogCents = Math.round((parseFloat(l.baseCost) || 0) * 100)
    const handlingPerItemCents = computeHandlingPerItem(cogCents, billingRule)
    const totalCents = (cogCents + handlingPerItemCents) * l.qty
    return { cogCents, handlingPerItemCents, totalCents }
  }

  const grandTotalCents = useMemo(
    () => lines.reduce((acc, l) => acc + lineNumbers(l).totalCents, 0),
    [lines],
  )

  const totalHandlingCents = useMemo(
    () => lines.reduce((acc, l) => acc + lineNumbers(l).handlingPerItemCents * l.qty, 0),
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
        description: line.name,
      }),
    })
    setSavingSku(null)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Save failed' }))
      toast.error(error || `SKU ${line.sku} save failed`)
      return
    }
    // Mirror the saved COG to any other lines with the same SKU
    setLines(prev =>
      prev.map(l =>
        l.sku === line.sku ? { ...l, baseCost: line.baseCost, skuInDb: true } : l,
      ),
    )
    toast.success(`Saved COG for ${line.sku}`)
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
              <th className="px-3 py-2 text-right font-semibold w-28">Handling/ea</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Line Total</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([orderNumber, orderLines]) => {
              const orderTotal = orderLines.reduce((acc, l) => acc + lineNumbers(l).totalCents, 0)
              const urgent = orderLines[0]?.urgent
              const absorbed = mergedFromByOrder[orderNumber] || []
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
                      {absorbed.length > 0 && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-900 text-white">
                          Merged with {absorbed.map(n => '#' + n).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fromCents(orderTotal)}</td>
                    <td></td>
                  </tr>
                  {orderLines.map(l => {
                    const { handlingPerItemCents, totalCents } = lineNumbers(l)
                    const hasHandling = handlingPerItemCents > 0
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
                          {l.mergedFromOrderNumber && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-900 text-white align-middle">
                              from #{l.mergedFromOrderNumber}
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
                        <td className="px-3 py-1 text-right tabular-nums">
                          {hasHandling ? (
                            <span className="text-slate-700">{fromCents(handlingPerItemCents)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums font-medium">{fromCents(totalCents)}</td>
                        <td className="px-3 py-1 text-right text-[11px]">
                          {savingSku === l.sku ? (
                            <span className="text-slate-400">saving…</span>
                          ) : !readOnly ? (
                            <EditLineMenu batchId={batchId} line={l} />
                          ) : null}
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
              <tr className="bg-slate-100 border-t border-slate-300">
                <td colSpan={4} className="px-3 py-1.5 text-right text-[12px] text-slate-600">Handling subtotal</td>
                <td className="px-3 py-1.5"></td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fromCents(totalHandlingCents)}</td>
                <td></td>
              </tr>
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
            <>Edit COG per line (saves to SKU DB on blur). Handling auto-applies per the rule above. Eyeball the total, then create the invoice.</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isInvoiced && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={deleteInvoice}
              disabled={deleting}
              className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              {deleting ? 'Deleting…' : 'Delete invoice & reopen batch'}
            </Button>
          )}
          {!isInvoiced && (
            <Button onClick={createInvoice} disabled={creatingInvoice || lines.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {creatingInvoice ? 'Creating…' : `Create Invoice — ${fromCents(grandTotalCents)}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
