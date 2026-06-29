'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export type OosFlag = 'out_of_stock' | 'backordered' | 'discontinued' | 'other'

export type OosRow = {
  sku: string
  name: string
  flag: OosFlag
  pendingUntil: string | null
  notes: string
  setAt: string | null
  orderCount: number
}

const STATUS: Record<OosFlag, { label: string; tone: string }> = {
  out_of_stock: { label: 'Out of stock', tone: 'bg-red-100 text-red-900 border-red-300' },
  backordered: { label: 'Backordered', tone: 'bg-amber-100 text-amber-900 border-amber-300' },
  discontinued: { label: 'Discontinued', tone: 'bg-slate-700 text-white border-slate-700' },
  other: { label: 'Other', tone: 'bg-slate-200 text-slate-800 border-slate-300' },
}

export function OosTable({ initial }: { initial: OosRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [flippedSkus, setFlippedSkus] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  async function markInStock(row: OosRow) {
    if (!confirm(`Mark ${row.sku} as in-stock? This will clear the status across ${row.orderCount} order${row.orderCount === 1 ? '' : 's'}.`)) return
    setBusy(row.sku)
    const r = await fetch(`/api/skus/${encodeURIComponent(row.sku)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusFlag: null, pendingUntil: null, notes: '' }),
    })
    setBusy(null)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    const d = await r.json()
    toast.success(`${row.sku} flipped to in-stock — cleared ${d.cascadedToItems} item${d.cascadedToItems === 1 ? '' : 's'}`)
    // Keep row visible (flipped) so vendor can later push to store catalog.
    const next = new Set(flippedSkus)
    next.add(row.sku)
    setFlippedSkus(next)
    setRows(rows.map(r2 => (r2.sku === row.sku ? r2 : r2)))
  }

  const activeRows = rows.filter(r => !flippedSkus.has(r.sku))
  const flippedRows = rows.filter(r => flippedSkus.has(r.sku))

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Out of Stock</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {activeRows.length} SKU{activeRows.length === 1 ? '' : 's'} currently flagged across the queue.
            {flippedRows.length > 0 && (
              <span className="ml-2 text-emerald-700">{flippedRows.length} flipped to in-stock this session.</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled className="bg-slate-400 cursor-not-allowed" title="Not implemented — placeholder for store catalog sync">
            Update store catalog (coming soon)
          </Button>
          <Button variant="outline" onClick={() => { setFlippedSkus(new Set()); router.refresh() }}>
            Refresh list
          </Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[12px] text-amber-900">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-800 mr-2">Heads up</span>
        Marking a SKU in-stock cascades to every queued order. The row stays here (greyed) so you can re-push to your store catalog later.
      </div>

      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-40">SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-left font-semibold w-36">Status</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Pending until</th>
              <th className="px-3 py-2 text-left font-semibold">Notes</th>
              <th className="px-3 py-2 text-right font-semibold w-20">Orders</th>
              <th className="px-3 py-2 text-right font-semibold w-36"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No SKUs are flagged right now.</td></tr>
            )}
            {rows.map(g => {
              const isFlipped = flippedSkus.has(g.sku)
              const s = STATUS[g.flag]
              return (
                <tr key={g.sku} className={`border-t border-slate-200 ${isFlipped ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-1.5 font-mono text-[12px]">{g.sku}</td>
                  <td className={`px-3 py-1.5 ${isFlipped ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{g.name}</td>
                  <td className="px-3 py-1.5">
                    {isFlipped ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-900 border border-emerald-300">
                        ✓ In stock
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${s.tone}`}>
                        {s.label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">
                    {g.pendingUntil ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-[12px]">
                    {g.notes ? <span className="italic" title={g.notes}>“{g.notes.length > 60 ? g.notes.slice(0, 57) + '…' : g.notes}”</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{g.orderCount}</td>
                  <td className="px-3 py-1.5 text-right">
                    {isFlipped ? (
                      <span className="text-[11px] text-slate-500 italic">awaiting store push</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markInStock(g)}
                        disabled={busy === g.sku}
                        className="h-7 text-[12px]"
                      >
                        {busy === g.sku ? 'Flipping…' : 'Mark in-stock'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
