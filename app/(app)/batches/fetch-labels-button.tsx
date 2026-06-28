'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function FetchLabelsButton({ lastFetchISO }: { lastFetchISO: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    const r = await fetch('/api/batches/fetch-labels', { method: 'POST' })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Fetch failed' }))
      toast.error(error || 'Fetch failed')
      return
    }
    const d = await r.json()
    if (!d.batchId) {
      toast.info(d.message || 'No new labels')
    } else {
      let msg = `Batch ${d.batchId}: ${d.itemsBatched} items across ${d.ordersTouched} orders`
      const extras: string[] = []
      if (d.partialOrders > 0) extras.push(`${d.partialOrders} partial`)
      if (d.unmatchedShipments > 0) extras.push(`${d.unmatchedShipments} unmatched`)
      if (extras.length) msg += ` (${extras.join(', ')})`
      toast.success(msg)
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {lastFetchISO && (
        <span className="text-[12px] text-slate-500">
          Last fetched: {new Date(lastFetchISO).toLocaleString()}
        </span>
      )}
      <Button onClick={go} disabled={busy} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
        {busy ? 'Fetching…' : 'Fetch Printed Labels'}
      </Button>
    </div>
  )
}
