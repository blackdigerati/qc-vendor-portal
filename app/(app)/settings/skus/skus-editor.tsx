'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { HANDLING_PER_ITEM_CENTS, SHIPPING_THRESHOLD_CENTS } from '@/lib/billing-rules'
import { fromCents } from '@/lib/money'

export type SkuRow = {
  sku: string
  description: string
  baseCost: string
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
    setRows([{ sku: '', description: '', baseCost: '0.00', active: true }, ...rows])
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
    <div className="space-y-3">
      <div className="bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-[12px] text-slate-700">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 mr-2">Billing rule</span>
        Shipping/handling is auto-applied at invoice time — any line with COG below{' '}
        <span className="font-medium tabular-nums">{fromCents(SHIPPING_THRESHOLD_CENTS)}</span> adds{' '}
        <span className="font-medium tabular-nums">{fromCents(HANDLING_PER_ITEM_CENTS)}</span> per item. Set just the COG here.
      </div>
      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 border-b border-slate-300">
          <Input placeholder="Filter SKUs…" value={filter} onChange={e => setFilter(e.target.value)} className="h-7 max-w-xs text-[13px] bg-white" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>+ Add SKU</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-40">SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-left font-semibold w-28">COG</th>
              <th className="px-3 py-2 text-center font-semibold w-20">Active</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">{rows.length === 0 ? 'No SKUs yet — click "+ Add SKU".' : 'No SKUs match.'}</td></tr>
            )}
            {filtered.map(r => {
              const i = rows.indexOf(r)
              return (
                <tr key={i} className="border-t border-slate-200">
                  <td className="px-1.5 py-1"><Input value={r.sku} onChange={e => patch(i, { sku: e.target.value })} className="h-7 font-mono text-[12px]" /></td>
                  <td className="px-1.5 py-1"><Input value={r.description} onChange={e => patch(i, { description: e.target.value })} className="h-7 text-[13px]" /></td>
                  <td className="px-1.5 py-1"><Input type="number" min="0" step="0.01" value={r.baseCost} onChange={e => patch(i, { baseCost: e.target.value })} className="h-7 text-right tabular-nums" /></td>
                  <td className="px-1.5 py-1 text-center"><Checkbox checked={r.active} onCheckedChange={v => patch(i, { active: !!v })} /></td>
                  <td className="px-1.5 py-1 text-right"><button onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-600 px-1" title="Remove">×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
