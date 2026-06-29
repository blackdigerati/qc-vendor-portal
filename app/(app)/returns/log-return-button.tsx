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

export function LogReturnButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const r = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, reason, notes }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    toast.success(`Return logged for #${orderNumber}`)
    setOpen(false)
    setOrderNumber('')
    setReason('')
    setNotes('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700">+ Log return</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a return</DialogTitle>
          <DialogDescription>
            Customer is returning an order. Vendor will mark received + enter credit amount when the goods arrive.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ono">Order #</Label>
            <Input id="ono" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="213069" className="font-mono" />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. wrong size, defect, customer changed mind" />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !orderNumber} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Logging…' : 'Log return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
