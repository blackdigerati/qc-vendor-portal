'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { fromCents } from '@/lib/money'

type LineDraft = { sku: string; name: string; qty: string; unitCost: string; handlingPerItem: string }

type Mode = 'quick' | 'lines'

export function NewInvoiceButton({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('quick')
  const [description, setDescription] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { sku: '', name: '', qty: '1', unitCost: '0.00', handlingPerItem: '0.00' },
  ])
  const [busy, setBusy] = useState(false)

  if (!isAdmin) return null

  function patch(i: number, fields: Partial<LineDraft>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...fields } : l)))
  }
  function addRow() {
    setLines([...lines, { sku: '', name: '', qty: '1', unitCost: '0.00', handlingPerItem: '0.00' }])
  }
  function removeRow(i: number) {
    setLines(lines.filter((_, idx) => idx !== i))
  }

  function linesTotalCents(): number {
    let t = 0
    for (const l of lines) {
      const qty = parseInt(l.qty || '1', 10) || 1
      const unit = Math.round((parseFloat(l.unitCost) || 0) * 100)
      const h = Math.round((parseFloat(l.handlingPerItem) || 0) * 100)
      t += (unit + h) * qty
    }
    return t
  }
  function quickTotalCents(): number {
    return Math.round((parseFloat(quickAmount) || 0) * 100)
  }
  const totalCents = mode === 'quick' ? quickTotalCents() : linesTotalCents()

  function resetAll() {
    setDescription('')
    setQuickAmount('')
    setLines([{ sku: '', name: '', qty: '1', unitCost: '0.00', handlingPerItem: '0.00' }])
    setMode('quick')
  }

  async function submit() {
    setBusy(true)
    const body =
      mode === 'quick'
        ? {
            description,
            lines: [{ sku: 'MANUAL', name: description || 'Manual charge', qty: 1, unitCost: quickAmount, handlingPerItem: 0 }],
          }
        : { description, lines }
    const r = await fetch('/api/invoices/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Create failed')
      return
    }
    const d = await r.json()
    toast.success(`Invoice ${d.invoiceId} created — ${fromCents(d.totalCents)}`)
    setOpen(false)
    resetAll()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetAll() }}>
      <DialogTrigger render={<Button variant="outline">+ Manual invoice</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New manual invoice</DialogTitle>
          <DialogDescription>
            For adjustments, carry-overs, or one-off vendor charges that aren&apos;t tied to a batch.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="inline-flex bg-slate-100 border border-slate-300 rounded-md p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={`px-3 py-1.5 rounded ${mode === 'quick' ? 'bg-white shadow-sm text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Quick — description + amount
          </button>
          <button
            type="button"
            onClick={() => setMode('lines')}
            className={`px-3 py-1.5 rounded ${mode === 'lines' ? 'bg-white shadow-sm text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Itemized — line by line
          </button>
        </div>

        {mode === 'quick' ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="qdesc">Description</Label>
              <Input
                id="qdesc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='e.g. "Previous older invoice 4324234" or "Carry-over balance"'
              />
            </div>
            <div>
              <Label htmlFor="qamt">Amount (USD)</Label>
              <Input
                id="qamt"
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={e => setQuickAmount(e.target.value)}
                className="text-right tabular-nums text-lg font-semibold"
              />
            </div>
            <p className="text-[12px] text-slate-500">
              Creates a one-line invoice (SKU <span className="font-mono">MANUAL</span>, qty 1). For multi-line breakdowns switch to <em>Itemized</em>.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea id="desc" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Vendor sample shipment adjustment" />
            </div>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-28">SKU / code</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-right w-14">Qty</th>
                    <th className="px-2 py-1.5 text-right w-24">Unit cost</th>
                    <th className="px-2 py-1.5 text-right w-24">Handling/ea</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-1 py-1"><Input value={l.sku} onChange={e => patch(i, { sku: e.target.value })} className="h-7 font-mono text-[11px]" placeholder="MANUAL" /></td>
                      <td className="px-1 py-1"><Input value={l.name} onChange={e => patch(i, { name: e.target.value })} className="h-7 text-[12px]" /></td>
                      <td className="px-1 py-1"><Input type="number" min="1" step="1" value={l.qty} onChange={e => patch(i, { qty: e.target.value })} className="h-7 text-right tabular-nums" /></td>
                      <td className="px-1 py-1"><Input type="number" min="0" step="0.01" value={l.unitCost} onChange={e => patch(i, { unitCost: e.target.value })} className="h-7 text-right tabular-nums" /></td>
                      <td className="px-1 py-1"><Input type="number" min="0" step="0.01" value={l.handlingPerItem} onChange={e => patch(i, { handlingPerItem: e.target.value })} className="h-7 text-right tabular-nums" /></td>
                      <td className="px-1 py-1 text-right"><button onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-600 px-1">×</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-300">
                    <td colSpan={4} className="px-2 py-1.5 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-600">Invoice total</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold">{fromCents(linesTotalCents())}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addRow}>+ Add line</Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || totalCents === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Creating…' : `Create — ${fromCents(totalCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
