'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { PullOrdersDialog } from './pull-dialog'

export type QueueItem = {
  id: string
  sku: string
  name: string
  qty: number
  cost: string
  skuMissing: boolean
}
export type QueueOrder = {
  orderNumber: string
  email: string
  customer: string
  city: string
  state: string
  urgent: boolean
  needsMerge: boolean
  items: QueueItem[]
}

export function QueueTable({ orders }: { orders: QueueOrder[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState(false)

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
  function orderState(o: QueueOrder): 'none' | 'partial' | 'all' {
    const inSel = o.items.filter(i => selected.has(i.id)).length
    if (inSel === 0) return 'none'
    if (inSel === o.items.length) return 'all'
    return 'partial'
  }

  const selectedCount = selected.size
  const summary = useMemo(() => {
    const ords = new Set<string>()
    for (const o of orders) {
      for (const i of o.items) if (selected.has(i.id)) ords.add(o.orderNumber)
    }
    return { items: selectedCount, orders: ords.size }
  }, [selected, orders, selectedCount])

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {selectedCount > 0 ? (
            <>Selected: <span className="font-medium text-slate-900">{summary.items}</span> items across {summary.orders} order{summary.orders === 1 ? '' : 's'}</>
          ) : (
            'Select orders or individual items to ship.'
          )}
        </div>
        <div className="flex gap-2">
          <PullOrdersDialog />
          <Button onClick={push} disabled={selectedCount === 0 || pushing}>
            {pushing ? 'Pushing…' : 'Push to ShipStation'}
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="w-10 px-4 py-2"></th>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Ship to</th>
              <th className="px-4 py-2 font-medium text-right">Items</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Queue is empty. Click <span className="font-medium">Pull new orders</span> to import.
                </td>
              </tr>
            )}
            {orders.map(o => {
              const st = orderState(o)
              return (
                <Fragment key={o.orderNumber}>
                  <tr className="border-t bg-white hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <Checkbox
                        checked={st === 'all'}
                        indeterminate={st === 'partial'}
                        onCheckedChange={v => toggleOrder(o, !!v)}
                      />
                    </td>
                    <td className="px-4 py-3 align-top font-medium">
                      <div className="flex items-center gap-2">
                        #{o.orderNumber}
                        {o.urgent && <Badge variant="destructive">URGENT</Badge>}
                        {o.needsMerge && <Badge variant="secondary">Merge?</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">{o.customer || '—'}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{o.email}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{[o.city, o.state].filter(Boolean).join(', ')}</td>
                    <td className="px-4 py-3 align-top text-right text-slate-600">{o.items.length}</td>
                  </tr>
                  {o.items.map(i => (
                    <tr key={i.id} className="border-t bg-slate-50/50">
                      <td className="pl-10 pr-4 py-2 align-top">
                        <Checkbox
                          checked={selected.has(i.id)}
                          onCheckedChange={v => toggleItem(i.id, !!v)}
                        />
                      </td>
                      <td colSpan={4} className="px-4 py-2 text-slate-600">
                        <span className="font-mono text-xs text-slate-500 mr-2">{i.sku || '—'}</span>
                        {i.name}
                        {i.skuMissing && <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">SKU not in DB</Badge>}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">×{i.qty} <span className="text-slate-400">· {i.cost}</span></td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
