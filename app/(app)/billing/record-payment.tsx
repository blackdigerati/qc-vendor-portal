'use client'

import { useMemo, useState } from 'react'
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

type OpenInv = { id: string; openCents: number }

export function RecordPaymentButton({
  invoices,
  isAdmin,
}: {
  invoices: OpenInv[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ref, setRef] = useState('')
  const [alloc, setAlloc] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const totalAllocated = useMemo(
    () => Object.values(alloc).reduce((acc, v) => acc + (parseFloat(v || '0') || 0), 0),
    [alloc],
  )
  const amtNum = parseFloat(amount || '0') || 0
  const remaining = amtNum - totalAllocated
  const overAllocated = remaining < -0.005

  function autoFill() {
    let left = amtNum
    const next: Record<string, string> = {}
    for (const inv of invoices) {
      if (left <= 0) break
      const openDollars = inv.openCents / 100
      const take = Math.min(left, openDollars)
      next[inv.id] = take.toFixed(2)
      left -= take
    }
    setAlloc(next)
  }

  function reset() {
    setAmount('')
    setRef('')
    setAlloc({})
  }

  async function submit() {
    setBusy(true)
    const body: Record<string, unknown> = {
      amount,
      paid_on: date,
      ref,
    }
    if (isAdmin) {
      const allocations = Object.entries(alloc)
        .map(([invoice_id, a]) => ({ invoice_id, amount: parseFloat(a || '0') || 0 }))
        .filter(a => a.amount > 0)
      if (allocations.length > 0) body.allocations = allocations
    }
    const r = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    const d = await r.json()
    if (d.autoApproved) {
      toast.success(
        `Payment recorded. Applied ${fromCents(d.allocated)}` +
          (d.unallocatedCredit > 0 ? ` · ${fromCents(d.unallocatedCredit)} kept as account credit` : ''),
      )
    } else {
      toast.success('Payment recorded — pending admin approval')
    }
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700">Record payment</Button>} />
      <DialogContent className={isAdmin ? 'max-w-xl' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>Record payment received</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Enter the amount, then allocate across one or more open invoices. Any unallocated amount stays as account credit.'
              : 'Admin will review and approve before it applies to the ledger.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="date">Paid on</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="ref">Reference / note</Label>
          <Textarea id="ref" rows={2} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. Zelle ABC123, check #4521" />
        </div>

        {isAdmin && (
          <section className="border border-slate-200 rounded-md overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[12px]">
              <span className="font-semibold uppercase tracking-wider text-slate-600">Allocate to invoices</span>
              <button
                type="button"
                onClick={autoFill}
                disabled={!amtNum || invoices.length === 0}
                className="text-slate-500 hover:text-slate-900 underline disabled:opacity-50"
              >
                Auto-fill in invoice order
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {invoices.length === 0 ? (
                <p className="text-[13px] text-slate-500 px-3 py-4">No open invoices — full amount will be account credit.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="px-3 py-1.5 font-semibold">Invoice</th>
                      <th className="px-3 py-1.5 text-right font-semibold w-28">Open</th>
                      <th className="px-3 py-1.5 text-right font-semibold w-32">Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-t border-slate-100">
                        <td className="px-3 py-1 font-mono">{inv.id}</td>
                        <td className="px-3 py-1 text-right tabular-nums text-slate-600">{fromCents(inv.openCents)}</td>
                        <td className="px-3 py-1 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={alloc[inv.id] || ''}
                            onChange={e => setAlloc({ ...alloc, [inv.id]: e.target.value })}
                            className="h-7 text-right tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[12px] flex items-center justify-between">
              <span className="text-slate-600">
                Allocated <span className="font-medium tabular-nums">${totalAllocated.toFixed(2)}</span> of <span className="font-medium tabular-nums">${amtNum.toFixed(2)}</span>
              </span>
              <span className={overAllocated ? 'text-red-700 font-semibold' : remaining > 0.005 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                {overAllocated
                  ? `Over by $${Math.abs(remaining).toFixed(2)}`
                  : remaining > 0.005
                    ? `$${remaining.toFixed(2)} → account credit (arrears)`
                    : 'Fully allocated'}
              </span>
            </div>
          </section>
        )}

        {!isAdmin && (
          <p className="text-[12px] text-slate-500 -mt-1">
            Admin will choose how to allocate this when they approve.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={busy || !amount || overAllocated}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {busy ? 'Saving…' : isAdmin ? 'Record & apply' : 'Submit for approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
