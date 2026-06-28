'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function FetchLabelsButton({ lastFetchISO }: { lastFetchISO: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [since, setSince] = useState<string>(isoDaysAgo(30))
  const [maxLabels, setMaxLabels] = useState<string>('10')
  const [useOverride, setUseOverride] = useState(true)

  async function go() {
    setBusy(true)
    const body: Record<string, unknown> = {}
    if (useOverride) {
      if (since) body.sinceISO = new Date(since).toISOString()
      const n = parseInt(maxLabels, 10)
      if (n > 0) body.maxLabels = n
    }
    const r = await fetch('/api/batches/fetch-labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Fetch failed' }))
      toast.error(error || 'Fetch failed')
      return
    }
    const d = await r.json()
    if (!d.batchId) {
      toast.info(d.message || `No labels found (scanned ${d.labelsScanned})`)
    } else {
      let msg = `Batch ${d.batchId}: ${d.itemsBatched} items across ${d.ordersTouched} orders (scanned ${d.labelsScanned} labels)`
      const extras: string[] = []
      if (d.partialOrders > 0) extras.push(`${d.partialOrders} partial`)
      if (d.unmatchedShipments > 0) extras.push(`${d.unmatchedShipments} unmatched`)
      if (extras.length) msg += ` · ${extras.join(', ')}`
      toast.success(msg)
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {lastFetchISO && (
        <span className="text-[12px] text-slate-500">
          Last fetched: {new Date(lastFetchISO).toLocaleString()}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Fetch Printed Labels</Button>
        } />
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fetch printed labels from ShipStation</DialogTitle>
            <DialogDescription>
              Pull recently-printed shipping labels and roll them into a new batch. Use the override
              to backfill historical labels for testing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={useOverride} onChange={e => setUseOverride(e.target.checked)} />
              <span>Use date override (otherwise picks up where last fetch left off)</span>
            </label>
            {useOverride && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="since">Fetch labels since</Label>
                  <Input id="since" type="date" value={since} onChange={e => setSince(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="max">Max labels (safety cap)</Label>
                  <Input id="max" type="number" min="1" step="1" value={maxLabels} onChange={e => setMaxLabels(e.target.value)} />
                </div>
              </div>
            )}
            {useOverride && (
              <p className="text-[11px] text-slate-500">
                Override runs don&apos;t advance the sync cursor — you can keep re-fetching the same window without losing your place.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={go} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? 'Fetching…' : 'Fetch labels'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
