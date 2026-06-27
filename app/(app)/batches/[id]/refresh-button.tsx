'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fromCents } from '@/lib/money'

export function RefreshBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function refresh() {
    setBusy(true)
    const r = await fetch(`/api/batches/${batchId}/refresh`, { method: 'POST' })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Refresh failed' }))
      toast.error(error || 'Refresh failed')
      return
    }
    const d = await r.json()
    const shippedNow = d.updates.length
    if (d.invoice) {
      toast.success(
        `All shipped — invoice ${d.invoice.invoiceId} created for ${fromCents(d.invoice.totalCents)}` +
        (d.invoice.warnings?.length ? ` (${d.invoice.warnings.length} warning${d.invoice.warnings.length === 1 ? '' : 's'})` : ''),
      )
    } else if (shippedNow > 0) {
      toast.success(`${shippedNow} order${shippedNow === 1 ? '' : 's'} now shipped`)
    } else {
      toast.info('No new label activity')
    }
    router.refresh()
  }
  return (
    <Button onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh status from ShipStation'}</Button>
  )
}
