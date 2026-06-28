'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PullOrdersDialog } from './pull-dialog'
import { NotesCell } from './notes-cell'
import { ItemStatusPill, OrderNotesModal, type OrderModalData } from './order-notes-modal'

export type QueueItem = {
  id: string
  sku: string
  name: string
  qty: number
  unitPrice: string
  skuMissing: boolean
  statusFlag: 'out_of_stock' | 'backordered' | 'discontinued' | 'other' | null
  pendingUntil: string | null
  itemNotes: string
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
  ssVerifyStatus: 'unverified' | 'verified' | 'email_matched' | 'not_found' | 'error'
  items: QueueItem[]
}

function VerifyPill({ status }: { status: QueueOrder['ssVerifyStatus'] }) {
  const map: Record<QueueOrder['ssVerifyStatus'], { label: string; cls: string }> = {
    unverified: { label: 'Not checked', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
    verified: { label: 'In SS', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    email_matched: { label: 'Email-matched', cls: 'bg-blue-100 text-blue-900 border-blue-300' },
    not_found: { label: 'Not in SS', cls: 'bg-red-100 text-red-900 border-red-300' },
    error: { label: 'Lookup error', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  }
  const it = map[status]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${it.cls}`}>
      {it.label}
    </span>
  )
}

export function QueueTable({
  orders,
  defaultSheetId = '',
  defaultSheetTab = 'Orders',
}: {
  orders: QueueOrder[]
  defaultSheetId?: string
  defaultSheetTab?: string
}) {
  const router = useRouter()
  const [filter, setFilter] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [modalOrder, setModalOrder] = useState<OrderModalData | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      o.orderNumber.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.notes.toLowerCase().includes(q) ||
      o.items.some(i =>
        i.sku.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.itemNotes.toLowerCase().includes(q),
      ),
    )
  }, [orders, filter])

  function openModal(o: QueueOrder) {
    setModalOrder({
      orderNumber: o.orderNumber,
      customer: o.customer,
      email: o.email,
      notes: o.notes,
      items: o.items.map(i => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        qty: i.qty,
        statusFlag: i.statusFlag,
        pendingUntil: i.pendingUntil,
        notes: i.itemNotes,
      })),
    })
  }

  async function verifyAll() {
    setVerifying(true)
    const r = await fetch('/api/orders/verify-ss', { method: 'POST' })
    setVerifying(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Verify failed' }))
      toast.error(error || 'Verify failed')
      return
    }
    const d = await r.json()
    toast.success(`Checked ${d.checked} orders — ${d.verified} found, ${d.emailMatched} email-matched, ${d.notFound} not in SS, ${d.errors} errors`)
    router.refresh()
  }

  const unverifiedCount = orders.filter(o => o.ssVerifyStatus === 'unverified').length

  return (
    <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 border-b border-slate-300">
        <div className="flex items-center gap-3 flex-1">
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter order#, email, customer, SKU, notes…"
            className="h-7 max-w-xs text-[13px] bg-white"
          />
          {unverifiedCount > 0 && (
            <span className="text-[12px] text-slate-500">
              <span className="font-semibold text-slate-900">{unverifiedCount}</span> not yet verified against ShipStation
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <PullOrdersDialog defaultSheetId={defaultSheetId} defaultSheetTab={defaultSheetTab} />
          <Button onClick={verifyAll} disabled={verifying || orders.length === 0} size="sm" variant="outline">
            {verifying ? 'Verifying…' : 'Verify against ShipStation'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-semibold w-44">Order</th>
            <th className="px-3 py-2 text-left font-semibold w-32">SS</th>
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
          {filtered.map(o => (
            <Fragment key={o.orderNumber}>
              <tr className={`border-t-2 border-slate-400 bg-slate-200 ${o.urgent ? 'border-l-4 border-l-red-600' : ''}`}>
                <td className="px-3 py-1.5 align-middle">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openModal(o)}
                      className="font-mono font-semibold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer"
                      title="Open notes & item status"
                    >
                      #{o.orderNumber}
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(o)}
                      className="text-slate-500 hover:text-emerald-700 p-0.5 rounded hover:bg-white"
                      title="Open notes & item status"
                      aria-label="Edit order notes"
                    >
                      <Pencil className="size-3.5" />
                    </button>
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
                <td className="px-3 py-1.5 align-middle"><VerifyPill status={o.ssVerifyStatus} /></td>
                <td className="px-3 py-1.5 align-middle text-slate-800">{o.customer || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-1.5 align-middle text-slate-600">{o.email}</td>
                <td className="px-3 py-1 align-middle text-slate-600">
                  <NotesCell orderNumber={o.orderNumber} initial={o.notes} />
                </td>
                <td className="px-3 py-1.5 align-middle text-right tabular-nums"></td>
                <td className="px-3 py-1.5 align-middle text-right tabular-nums"></td>
              </tr>
              {o.items.map(i => (
                <tr key={i.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                  <td className="px-3 py-1 align-middle"></td>
                  <td className="px-3 py-1 align-middle"></td>
                  <td colSpan={3} className="px-3 py-1 align-middle text-slate-700 pl-8">
                    <span className="font-mono text-[11px] text-slate-500 mr-2 inline-block w-24 align-middle">
                      {i.sku || <span className="text-slate-400">no-sku</span>}
                    </span>
                    <span className="align-middle">{i.name}</span>
                    {i.skuMissing && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300 align-middle">
                        SKU not in DB
                      </span>
                    )}
                    {i.statusFlag && (
                      <span className="ml-2 align-middle">
                        <ItemStatusPill flag={i.statusFlag} pendingUntil={i.pendingUntil} />
                      </span>
                    )}
                    {i.itemNotes && (
                      <span className="ml-2 text-[11px] text-slate-500 italic align-middle" title={i.itemNotes}>
                        “{i.itemNotes.length > 60 ? i.itemNotes.slice(0, 57) + '…' : i.itemNotes}”
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1 align-middle text-right text-slate-700 tabular-nums">{i.qty}</td>
                  <td className="px-3 py-1 align-middle text-right text-slate-700 tabular-nums">{i.unitPrice}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      <OrderNotesModal
        open={!!modalOrder}
        onClose={() => setModalOrder(null)}
        initial={modalOrder}
      />
    </div>
  )
}
