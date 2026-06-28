'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export type SimQueueItem = {
  id: string
  sku: string
  name: string
  qty: number
}
export type SimQueueOrder = {
  orderNumber: string
  customer: string
  items: SimQueueItem[]
}

export function SimulateLabelsDialog({ queue }: { queue: SimQueueOrder[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const allItemIds = useMemo(() => queue.flatMap(o => o.items.map(i => i.id)), [queue])
  const allChecked = allItemIds.length > 0 && allItemIds.every(id => selected.has(id))
  const someChecked = !allChecked && allItemIds.some(id => selected.has(id))

  function toggleItem(id: string, on: boolean) {
    const next = new Set(selected)
    on ? next.add(id) : next.delete(id)
    setSelected(next)
  }
  function toggleOrder(o: SimQueueOrder, on: boolean) {
    const next = new Set(selected)
    o.items.forEach(i => (on ? next.add(i.id) : next.delete(i.id)))
    setSelected(next)
  }
  function toggleAll(on: boolean) {
    const next = new Set(selected)
    if (on) allItemIds.forEach(id => next.add(id))
    else allItemIds.forEach(id => next.delete(id))
    setSelected(next)
  }
  function orderState(o: SimQueueOrder): 'none' | 'partial' | 'all' {
    const inSel = o.items.filter(i => selected.has(i.id)).length
    if (inSel === 0) return 'none'
    if (inSel === o.items.length) return 'all'
    return 'partial'
  }

  async function submit() {
    if (selected.size === 0) return
    setBusy(true)
    const r = await fetch('/api/dev/simulate-labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [...selected] }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    const d = await r.json()
    toast.success(
      `Simulated ${d.itemsBatched} items into ${d.batchId} — ${d.fullyShippedOrders} full / ${d.partialOrders} partial`,
    )
    setOpen(false)
    setSelected(new Set())
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100">
          🧪 Simulate Label Print
        </Button>
      } />
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulate Label Print (dev only)</DialogTitle>
          <DialogDescription>
            Pick queued items to fake-ship. Creates a batch just like &quot;Fetch Printed Labels&quot; would —
            but skips ShipStation entirely. Use this to test the batch / invoice / ledger flow without printing real labels.
          </DialogDescription>
        </DialogHeader>

        {queue.length === 0 ? (
          <div className="text-center text-slate-500 py-8">No queued items. Pull some orders first.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-200">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked}
                onCheckedChange={v => toggleAll(!!v)}
              />
              <span className="text-[12px] font-medium text-slate-700">Select all queued</span>
              <span className="ml-auto text-[12px] text-slate-500">{selected.size} selected</span>
            </div>
            <div className="space-y-1 max-h-[55vh] overflow-y-auto">
              {queue.map(o => {
                const st = orderState(o)
                return (
                  <Fragment key={o.orderNumber}>
                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 border-t-2 border-slate-300">
                      <Checkbox
                        checked={st === 'all'}
                        indeterminate={st === 'partial'}
                        onCheckedChange={v => toggleOrder(o, !!v)}
                      />
                      <span className="font-mono font-semibold text-slate-900 text-[13px]">#{o.orderNumber}</span>
                      <span className="text-[12px] text-slate-500">— {o.customer || '—'}</span>
                    </div>
                    {o.items.map(i => (
                      <label key={i.id} className="flex items-center gap-2 px-8 py-1 hover:bg-slate-50 cursor-pointer">
                        <Checkbox
                          checked={selected.has(i.id)}
                          onCheckedChange={v => toggleItem(i.id, !!v)}
                        />
                        <span className="font-mono text-[11px] text-slate-500 inline-block w-24">{i.sku || 'no-sku'}</span>
                        <span className="text-[13px] text-slate-700">{i.name}</span>
                        <span className="ml-auto text-[12px] text-slate-500 tabular-nums">×{i.qty}</span>
                      </label>
                    ))}
                  </Fragment>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={busy || selected.size === 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {busy ? 'Simulating…' : `Simulate label print → batch (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
