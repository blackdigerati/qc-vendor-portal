'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function BillingRulesForm({ initialThreshold, initialPerItem }: { initialThreshold: string; initialPerItem: string }) {
  const router = useRouter()
  const [threshold, setThreshold] = useState(initialThreshold)
  const [perItem, setPerItem] = useState(initialPerItem)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const r = await fetch('/api/settings/billing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold, perItem }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Save failed' }))
      toast.error(error || 'Save failed')
      return
    }
    toast.success('Billing rule updated')
    router.refresh()
  }

  return (
    <div className="bg-white border border-slate-300 rounded-md p-5 max-w-md space-y-3 shadow-sm">
      <div>
        <Label htmlFor="th">COG threshold (USD)</Label>
        <Input id="th" type="number" min="0" step="0.01" value={threshold} onChange={e => setThreshold(e.target.value)} />
        <p className="text-[12px] text-slate-500 mt-1">Lines with COG <em>below</em> this value get the handling charge.</p>
      </div>
      <div>
        <Label htmlFor="pi">Handling per item (USD)</Label>
        <Input id="pi" type="number" min="0" step="0.01" value={perItem} onChange={e => setPerItem(e.target.value)} />
        <p className="text-[12px] text-slate-500 mt-1">Added per item (qty × this amount) on qualifying lines.</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
