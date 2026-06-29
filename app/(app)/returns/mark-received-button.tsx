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

export function MarkReceivedButton({ returnId, orderNumber }: { returnId: string; orderNumber: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [credit, setCredit] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const r = await fetch(`/api/returns/${returnId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credit, notes }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    toast.success(`Received — $${credit} credited for #${orderNumber}`)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700">Mark received</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark return received — #{orderNumber}</DialogTitle>
          <DialogDescription>
            Enter the COG credit amount based on what came back.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amt">Credit amount (USD)</Label>
            <Input id="amt" type="number" min="0" step="0.01" value={credit} onChange={e => setCredit(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rn">Notes (optional)</Label>
            <Textarea id="rn" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !credit} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Saving…' : 'Confirm receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
