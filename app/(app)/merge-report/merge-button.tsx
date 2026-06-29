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

type MergeResult = {
  keepOrderNumber: string
  merged: number
  mergeOrderNumbers: string[]
}

export function MergeGroupButton({ email, candidates }: { email: string; candidates: MergeCandidate[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [keep, setKeep] = useState(candidates[0]?.orderNumber || '')
  const [busy, setBusy] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState<MergeResult | null>(null)

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
    setOpen(false)
    setResult({
      keepOrderNumber: d.keepOrderNumber,
      merged: d.merged,
      mergeOrderNumbers: mergeList,
    })
    setResultOpen(true)
  }

  function closeResult() {
    setResultOpen(false)
    setResult(null)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button
          size="sm"
          className={
            allMatch
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
          }
        >
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

      {/* Result modal — replaces the toast */}
      <Dialog open={resultOpen} onOpenChange={v => { if (!v) closeResult() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge complete ✓</DialogTitle>
            <DialogDescription>
              The portal has combined the orders and moved every line item onto the survivor.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3 text-[13px]">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Surviving order</div>
                <div className="font-mono text-slate-900 text-[15px] font-semibold">#{result.keepOrderNumber}</div>
                <div className="text-[12px] text-slate-600 mt-1">
                  {result.merged} order{result.merged === 1 ? '' : 's'} merged into this one — items show <em>“from #X”</em> beside them.
                </div>
              </div>
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
                <div className="text-[11px] uppercase tracking-wider font-semibold mb-1">Don&apos;t forget</div>
                Open ShipStation and finalize the merge in the SS UI — the portal flagged both shipments with a <span className="font-mono">Merge</span> tag + note so they&apos;re easy to find.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={closeResult} className="bg-emerald-600 hover:bg-emerald-700">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
