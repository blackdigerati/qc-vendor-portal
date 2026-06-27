'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { fromCents } from '@/lib/money'

type OpenInv = { id: string; openCents: number }

export function ApprovePaymentButton({
  paymentId, amountCents, openInvoices,
}: {
  paymentId: string
  amountCents: number
  openInvoices: OpenInv[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [alloc, setAlloc] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const totalAllocated = useMemo(
    () => Object.values(alloc).reduce((acc, v) => acc + (parseFloat(v || '0') || 0), 0),
    [alloc],
  )
  const amountDollars = amountCents / 100
  const remaining = amountDollars - totalAllocated

  async function approve() {
    setBusy(true)
    const allocations = Object.entries(alloc)
      .map(([invoice_id, amount]) => ({ invoice_id, amount: parseFloat(amount || '0') || 0 }))
      .filter(a => a.amount > 0)
    const r = await fetch(`/api/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    const d = await r.json()
    toast.success(
      `Approved. Allocated ${fromCents(d.allocated)}` +
      (d.unallocatedCredit > 0 ? ` · ${fromCents(d.unallocatedCredit)} credit on account` : ''),
    )
    setOpen(false)
    router.refresh()
  }

  function autoFill() {
    let left = amountDollars
    const next: Record<string, string> = {}
    for (const inv of openInvoices) {
      if (left <= 0) break
      const open = inv.openCents / 100
      const take = Math.min(left, open)
      next[inv.id] = take.toFixed(2)
      left -= take
    }
    setAlloc(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Approve</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve {fromCents(amountCents)}</DialogTitle>
          <DialogDescription>
            Split this payment across open invoices. Unallocated amount becomes account credit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {openInvoices.length === 0 && (
            <p className="text-sm text-slate-500">No open invoices — the full amount will become unallocated credit.</p>
          )}
          {openInvoices.map(inv => (
            <div key={inv.id} className="flex items-center gap-3">
              <Label className="w-44 text-sm">{inv.id} <span className="text-slate-400 ml-1">({fromCents(inv.openCents)} open)</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={alloc[inv.id] || ''}
                onChange={e => setAlloc({ ...alloc, [inv.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="text-sm text-slate-600 flex justify-between border-t pt-3">
          <button type="button" onClick={autoFill} className="text-slate-500 hover:text-slate-900 underline">Auto-fill in invoice order</button>
          <span>
            Allocated: ${totalAllocated.toFixed(2)} · {remaining >= 0 ? 'Credit' : 'Over'}: ${Math.abs(remaining).toFixed(2)}
          </span>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={approve} disabled={busy || remaining < 0}>{busy ? 'Approving…' : 'Approve'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
