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

export function NewInvoiceButton({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
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
  function totalCents(): number {
    let t = 0
    for (const l of lines) {
      const qty = parseInt(l.qty || '1', 10) || 1
      const unit = Math.round((parseFloat(l.unitCost) || 0) * 100)
      const h = Math.round((parseFloat(l.handlingPerItem) || 0) * 100)
      t += (unit + h) * qty
    }
    return t
  }

  async function submit() {
    setBusy(true)
    const r = await fetch('/api/invoices/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, lines }),
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
    setDescription('')
    setLines([{ sku: '', name: '', qty: '1', unitCost: '0.00', handlingPerItem: '0.00' }])
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">+ Manual invoice</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New manual invoice</DialogTitle>
          <DialogDescription>
            Create an invoice that isn&apos;t tied to a batch — e.g. an adjustment, a one-off vendor charge.
            Line items appear on the ledger and contribute to outstanding balance just like a batch invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="desc">Description</Label>
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
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold">{fromCents(totalCents())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addRow}>+ Add line</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || totalCents() === 0} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Creating…' : `Create — ${fromCents(totalCents())}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
