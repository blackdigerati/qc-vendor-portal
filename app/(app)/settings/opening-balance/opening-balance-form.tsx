'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OpeningBalanceForm({ initialAmount, initialDate }: { initialAmount: string; initialDate: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState(initialAmount)
  const [date, setDate] = useState(initialDate)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const r = await fetch('/api/settings/opening-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, as_of: date }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Save failed')
      return
    }
    toast.success('Saved')
    router.refresh()
  }

  return (
    <div className="bg-white border rounded-lg p-5 max-w-md space-y-3">
      <div>
        <Label htmlFor="amt">Amount currently owed (USD)</Label>
        <Input id="amt" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="dt">As of</Label>
        <Input id="dt" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}
