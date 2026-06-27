'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

export type SkuRow = {
  sku: string
  description: string
  baseCost: string
  shippingAddon: string
  active: boolean
}

export function SkusEditor({ initial }: { initial: SkuRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<SkuRow[]>(initial)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)

  function patch(idx: number, fields: Partial<SkuRow>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...fields } : r)))
  }
  function addRow() {
    setRows([{ sku: '', description: '', baseCost: '0.00', shippingAddon: '0.00', active: true }, ...rows])
  }
  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    const r = await fetch('/api/settings/skus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus: rows }),
    })
    setSaving(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Save failed')
      return
    }
    const d = await r.json()
    toast.success(`Saved ${d.upserted} SKUs${d.deleted ? `, removed ${d.deleted}` : ''}`)
    router.refresh()
  }

  const filtered = rows.filter(r => !filter || r.sku.toLowerCase().includes(filter.toLowerCase()) || r.description.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <Input placeholder="Filter SKUs…" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={addRow}>+ Add SKU</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-40">SKU</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium w-28">Base cost</th>
              <th className="px-3 py-2 font-medium w-28">Shipping</th>
              <th className="px-3 py-2 font-medium w-20 text-center">Active</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No SKUs match.</td></tr>
            )}
            {filtered.map((r, idx) => {
              const i = rows.indexOf(r)
              return (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1"><Input value={r.sku} onChange={e => patch(i, { sku: e.target.value })} className="h-8" /></td>
                  <td className="px-2 py-1"><Input value={r.description} onChange={e => patch(i, { description: e.target.value })} className="h-8" /></td>
                  <td className="px-2 py-1"><Input type="number" min="0" step="0.01" value={r.baseCost} onChange={e => patch(i, { baseCost: e.target.value })} className="h-8 text-right" /></td>
                  <td className="px-2 py-1"><Input type="number" min="0" step="0.01" value={r.shippingAddon} onChange={e => patch(i, { shippingAddon: e.target.value })} className="h-8 text-right" /></td>
                  <td className="px-2 py-1 text-center"><Checkbox checked={r.active} onCheckedChange={v => patch(i, { active: !!v })} /></td>
                  <td className="px-2 py-1 text-right"><button onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-600" title="Remove">×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
