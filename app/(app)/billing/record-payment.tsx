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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fromCents } from '@/lib/money'

export function RecordPaymentButton({ invoices }: { invoices: { id: string; openCents: number }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ref, setRef] = useState('')
  const [invoiceId, setInvoiceId] = useState<string>('none')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const r = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        paid_on: date,
        ref,
        invoice_id: invoiceId === 'none' ? null : invoiceId,
      }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    toast.success('Payment recorded — pending admin approval')
    setOpen(false)
    setAmount('')
    setRef('')
    setInvoiceId('none')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Record payment</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment received</DialogTitle>
          <DialogDescription>Admin will review and approve before it applies to the ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="date">Paid on</Label>
            <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv">Intended invoice (optional)</Label>
            <Select value={invoiceId} onValueChange={v => setInvoiceId(v ?? 'none')}>
              <SelectTrigger id="inv"><SelectValue placeholder="On account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">On account (no specific invoice)</SelectItem>
                {invoices.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.id} — {fromCents(i.openCents)} open</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ref">Reference / note</Label>
            <Textarea id="ref" rows={2} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. Zelle ABC123, check #4521" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !amount}>{busy ? 'Saving…' : 'Submit'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
