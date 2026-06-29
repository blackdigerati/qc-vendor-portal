'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export type MergeAllGroup = {
  email: string
  keepOrderNumber: string
  mergeOrderNumbers: string[]
}

export function MergeAllButton({ groups }: { groups: MergeAllGroup[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function mergeAll() {
    if (!confirm(`Merge all ${groups.length} matching groups? The lowest order # becomes the survivor in each.`)) return
    setBusy(true)
    let ok = 0
    let failed = 0
    let fallback = 0
    for (const g of groups) {
      const r = await fetch('/api/orders/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keepOrderNumber: g.keepOrderNumber,
          mergeOrderNumbers: g.mergeOrderNumbers,
        }),
      })
      if (!r.ok) {
        failed++
        continue
      }
      const d = await r.json()
      ok++
      if (d.anyFallback) fallback++
    }
    setBusy(false)
    if (failed === 0) {
      toast.success(
        `Merged ${ok} groups${fallback > 0 ? ` (${fallback} used note/tag fallback)` : ''}`,
        { duration: 6000 },
      )
    } else {
      toast.warning(`Merged ${ok}, ${failed} failed`, { duration: 8000 })
    }
    router.refresh()
  }

  return (
    <Button onClick={mergeAll} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
      {busy ? `Merging ${groups.length}…` : `Merge all (${groups.length} matching)`}
    </Button>
  )
}
