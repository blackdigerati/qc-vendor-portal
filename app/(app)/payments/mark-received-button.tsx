'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fromCents } from '@/lib/money'

export function MarkReceivedButton({ paymentId, amountCents }: { paymentId: string; amountCents: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!confirm(`Confirm receipt of ${fromCents(amountCents)}? This applies the allocation to invoices.`)) return
    setBusy(true)
    const r = await fetch(`/api/payments/${paymentId}/receive`, { method: 'POST' })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    const d = await r.json()
    toast.success(`Received. ${d.invoicesUpdated} invoice${d.invoicesUpdated === 1 ? '' : 's'} updated.`)
    router.refresh()
  }
  return (
    <Button size="sm" onClick={go} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
      {busy ? 'Confirming…' : 'Mark received'}
    </Button>
  )
}
