'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PullOrdersDialog } from './pull-dialog'

export type QueueItem = {
  id: string
  sku: string
  name: string
  qty: number
  unitPrice: string
  skuMissing: boolean
}
export type QueueOrder = {
  orderNumber: string
  email: string
  customer: string
  city: string
  state: string
  notes: string
  urgent: boolean
  needsMerge: boolean
  items: QueueItem[]
}

export function QueueTable({ orders }: { orders: QueueOrder[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState(false)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      o.orderNumber.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.notes.toLowerCase().includes(q) ||
      o.items.some(i => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)),
    )
  }, [orders, filter])

  const allItemIds = useMemo(() => filtered.flatMap(o => o.items.map(i => i.id)), [filtered])
  const allChecked = allItemIds.length > 0 && allItemIds.every(id => selected.has(id))
  const someChecked = !allChecked && allItemIds.some(id => selected.has(id))

  function toggleItem(id: string, on: boolean) {
    const next = new Set(selected)
    on ? next.add(id) : next.delete(id)
    setSelected(next)
  }
  function toggleOrder(o: QueueOrder, on: boolean) {
    const next = new Set(selected)
    o.items.forEach(i => (on ? next.add(i.id) : next.delete(i.id)))
    setSelected(next)
  }
  function toggleAll(on: boolean) {
    const next = new Set(selected)
    if (on) allItemIds.forEach(id => next.add(id))
    else allItemIds.forEach(id => next.delete(id))
    setSelected(next)
  }
  function orderState(o: QueueOrder): 'none' | 'partial' | 'all' {
    const inSel = o.items.filter(i => selected.has(i.id)).length
    if (inSel === 0) return 'none'
    if (inSel === o.items.length) return 'all'
    return 'partial'
  }

  const summary = useMemo(() => {
    const ords = new Set<string>()
    for (const o of orders) {
      for (const i of o.items) if (selected.has(i.id)) ords.add(o.orderNumber)
    }
    return { items: selected.size, orders: ords.size }
  }, [selected, orders])

  async function push() {
    if (selected.size === 0) return
    setPushing(true)
    const r = await fetch('/api/batches/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: [...selected] }),
    })
    setPushing(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Push failed' }))
      toast.error(error || 'Push failed')
      return
    }
    const data = await r.json()
    toast.success(`Batch ${data.batchId} created — ${data.tagged}/${data.total} tagged in ShipStation`)
    setSelected(new Set())
    router.refresh()
  }

  return (
    <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 border-b border-slate-300">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 pl-1">
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onCheckedChange={v => toggleAll(!!v)}
              aria-label="Select all"
            />
            <span className="text-[12px] text-slate-600 font-medium select-none">Select all</span>
          </div>
          <div className="w-px h-5 bg-slate-300" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter order#, email, customer, SKU, notes…"
            className="h-7 max-w-xs text-[13px] bg-white"
          />
          <div className="text-[12px] text-slate-600">
            {summary.items > 0 ? (
              <span><span className="font-semibold text-slate-900">{summary.items}</span> item{summary.items === 1 ? '' : 's'} · {summary.orders} order{summary.orders === 1 ? '' : 's'}</span>
            ) : (
              <span className="text-slate-500">Nothing selected</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <PullOrdersDialog />
          <Button onClick={push} disabled={selected.size === 0 || pushing} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            {pushing ? 'Pushing…' : `Push${selected.size > 0 ? ` ${summary.orders}` : ''} to ShipStation`}
          </Button>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
            <th className="w-8 px-3 py-2 text-left"></th>
            <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
            <th className="px-3 py-2 text-left font-semibold">Customer</th>
            <th className="px-3 py-2 text-left font-semibold">Email</th>
            <th className="px-3 py-2 text-left font-semibold">Notes</th>
            <th className="px-3 py-2 text-right font-semibold w-16">Qty</th>
            <th className="px-3 py-2 text-right font-semibold w-24">Unit Price</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                {orders.length === 0 ? (
                  <>Queue is empty. Click <span className="font-medium text-slate-700">Pull new orders</span> to import.</>
                ) : (
                  <>No orders match &quot;{filter}&quot;.</>
                )}
              </td>
            </tr>
          )}
          {filtered.map(o => {
            const st = orderState(o)
            const sel = st !== 'none'
            const totalQty = o.items.reduce((acc, i) => acc + i.qty, 0)
            return (
              <Fragment key={o.orderNumber}>
                <tr className={`border-t border-slate-200 ${sel ? 'bg-emerald-50/60' : 'hover:bg-slate-50'} ${o.urgent ? 'border-l-2 border-l-red-500' : ''}`}>
                  <td className="px-3 py-1.5 align-middle">
                    <Checkbox
                      checked={st === 'all'}
                      indeterminate={st === 'partial'}
                      onCheckedChange={v => toggleOrder(o, !!v)}
                    />
                  </td>
                  <td className="px-3 py-1.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-slate-900">#{o.orderNumber}</span>
                      {o.urgent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                          Urgent
                        </span>
                      )}
                      {o.needsMerge && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
                          Merge?
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 align-middle text-slate-800">{o.customer || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-1.5 align-middle text-slate-600">{o.email}</td>
                  <td className="px-3 py-1.5 align-middle text-slate-600">
                    {o.notes ? (
                      <span className="block max-w-[280px] truncate" title={o.notes}>
                        {o.notes}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-middle text-right text-slate-700 tabular-nums font-medium">{totalQty}</td>
                  <td className="px-3 py-1.5 align-middle text-right text-slate-400 tabular-nums">—</td>
                </tr>
                {o.items.map(i => {
                  const checked = selected.has(i.id)
                  return (
                    <tr key={i.id} className={`border-t border-slate-100 ${checked ? 'bg-emerald-50/40' : 'bg-slate-50/40'}`}>
                      <td className="pl-8 pr-3 py-1 align-middle">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={v => toggleItem(i.id, !!v)}
                        />
                      </td>
                      <td className="px-3 py-1 align-middle"></td>
                      <td colSpan={4} className="px-3 py-1 align-middle text-slate-700">
                        <span className="font-mono text-[11px] text-slate-500 mr-2 inline-block w-24 align-middle">
                          {i.sku || <span className="text-slate-400">no-sku</span>}
                        </span>
                        <span className="align-middle">{i.name}</span>
                        {i.skuMissing && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300 align-middle">
                            SKU not in DB
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 align-middle text-right text-slate-700 tabular-nums">{i.qty}</td>
                      <td className="px-3 py-1 align-middle text-right text-slate-700 tabular-nums">{i.unitPrice}</td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
