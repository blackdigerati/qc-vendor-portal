'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export type MergeCandidate = {
  orderNumber: string
  customer: string
  shipTo: string
  addressMatches: boolean
}

export function MergeGroupButton({ email, candidates }: { email: string; candidates: MergeCandidate[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keep, setKeep] = useState(candidates[0]?.orderNumber || '')
  const [busy, setBusy] = useState(false)

  const allMatch = candidates.every(c => c.addressMatches)

  async function doMerge() {
    if (!keep) return
    const mergeList = candidates.map(c => c.orderNumber).filter(o => o !== keep)
    if (mergeList.length === 0) {
      toast.info('Pick a survivor that is different from the others')
      return
    }
    setBusy(true)
    const r = await fetch('/api/orders/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepOrderNumber: keep, mergeOrderNumbers: mergeList }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Merge failed' }))
      toast.error(error || 'Merge failed')
      return
    }
    const d = await r.json()
    if (d.anyFallback) {
      toast.warning(
        `Merged ${d.merged} into #${d.keepOrderNumber} — SS merge API unavailable, wrote notes + Merge tag on shipments (finish in SS UI).`,
        { duration: 8000 },
      )
    } else {
      toast.success(`Merged ${d.merged} into #${d.keepOrderNumber} via ShipStation`)
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant={allMatch ? 'default' : 'outline'} className={allMatch ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
          Merge {candidates.length} orders
        </Button>
      } />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge orders for {email}</DialogTitle>
          <DialogDescription>
            Pick the surviving order #. The others will be merged into it in ShipStation and marked cancelled in the portal.
          </DialogDescription>
        </DialogHeader>

        {!allMatch && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            ⚠ Shipping addresses don&apos;t all match. Double-check before merging.
          </div>
        )}

        <div className="space-y-2">
          {candidates.map(c => (
            <label key={c.orderNumber} className="flex items-start gap-3 px-3 py-2 rounded border border-slate-200 hover:border-slate-300 cursor-pointer">
              <input
                type="radio"
                name="keep"
                value={c.orderNumber}
                checked={keep === c.orderNumber}
                onChange={() => setKeep(c.orderNumber)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono font-semibold text-slate-900">#{c.orderNumber}</div>
                <div className="text-[12px] text-slate-600">{c.customer}</div>
                <div className="text-[12px] text-slate-500 truncate" title={c.shipTo}>{c.shipTo}</div>
                {!c.addressMatches && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 mt-1">
                    Address differs
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={doMerge} disabled={busy || !keep} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Merging…' : `Merge into #${keep}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
