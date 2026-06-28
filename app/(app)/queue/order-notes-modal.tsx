'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export type ItemDraft = {
  id: string
  sku: string
  name: string
  qty: number
  statusFlag: 'out_of_stock' | 'backordered' | 'discontinued' | 'other' | null
  pendingUntil: string | null // YYYY-MM-DD
  notes: string
}

export type OrderModalData = {
  orderNumber: string
  customer: string
  email: string
  notes: string
  items: ItemDraft[]
}

const ORDER_CHIPS = [
  'Bad address',
  'Incomplete address',
  'Address verification needed',
  'Customer contacted',
  'Hold for instructions',
]

const ITEM_CHIPS_BY_STATUS: Record<NonNullable<ItemDraft['statusFlag']>, string[]> = {
  out_of_stock: ['Out of stock — no ETA', 'Substitute offered'],
  backordered: ['Vendor restocking', 'Awaiting shipment from supplier'],
  discontinued: ['No longer available — refund recommended', 'Suggest replacement SKU'],
  other: [],
}

const STATUS_LABELS: Record<NonNullable<ItemDraft['statusFlag']>, string> = {
  out_of_stock: 'Out of stock',
  backordered: 'Backordered',
  discontinued: 'Discontinued',
  other: 'Other',
}

export function OrderNotesModal({
  open,
  onClose,
  initial,
}: {
  open: boolean
  onClose: () => void
  initial: OrderModalData | null
}) {
  const router = useRouter()
  const [orderNotes, setOrderNotes] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setOrderNotes(initial.notes)
      setItems(initial.items.map(i => ({ ...i })))
    }
  }, [initial])

  if (!initial) return null

  function patchItem(idx: number, fields: Partial<ItemDraft>) {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...fields } : it)))
  }

  function addToOrderNotes(chip: string) {
    setOrderNotes(prev => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed} · ${chip}` : chip
    })
  }
  function addToItemNotes(idx: number, chip: string) {
    const it = items[idx]
    const trimmed = it.notes.trim()
    patchItem(idx, { notes: trimmed ? `${trimmed} · ${chip}` : chip })
  }

  async function save() {
    if (!initial) return
    setSaving(true)
    try {
      const reqs: Promise<Response>[] = []
      if (orderNotes !== initial.notes) {
        reqs.push(
          fetch(`/api/orders/${encodeURIComponent(initial.orderNumber)}/notes`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: orderNotes }),
          }),
        )
      }
      for (const [idx, draft] of items.entries()) {
        const before = initial.items[idx]
        if (
          draft.statusFlag !== before.statusFlag ||
          draft.pendingUntil !== before.pendingUntil ||
          draft.notes !== before.notes
        ) {
          reqs.push(
            fetch(`/api/order-items/${encodeURIComponent(draft.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                statusFlag: draft.statusFlag,
                pendingUntil: draft.pendingUntil,
                notes: draft.notes,
              }),
            }),
          )
        }
      }
      if (reqs.length === 0) {
        onClose()
        return
      }
      const results = await Promise.all(reqs)
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        toast.error(`${failed} change${failed === 1 ? '' : 's'} failed to save`)
      } else {
        toast.success(`Saved ${reqs.length} change${reqs.length === 1 ? '' : 's'}`)
        onClose()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">
            #{initial.orderNumber}
            <span className="ml-2 font-sans font-normal text-slate-600 text-[14px]">
              {initial.customer || initial.email}
            </span>
          </DialogTitle>
          <DialogDescription>
            Add notes for the whole order or flag individual items as out-of-stock, backordered, or discontinued.
          </DialogDescription>
        </DialogHeader>

        {/* Order-level */}
        <section className="border border-slate-200 rounded-md p-3 bg-slate-50">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 mb-2">Order notes</h3>
          <Textarea
            value={orderNotes}
            onChange={e => setOrderNotes(e.target.value)}
            rows={2}
            placeholder="e.g. confirm address with customer before shipping"
            className="bg-white"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ORDER_CHIPS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => addToOrderNotes(c)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400"
              >
                + {c}
              </button>
            ))}
          </div>
        </section>

        {/* Item-level */}
        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">Items</h3>
          {items.map((it, idx) => (
            <div key={it.id} className="border border-slate-200 rounded-md p-3 bg-white">
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-slate-900">{it.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{it.sku || 'no-sku'} · qty {it.qty}</div>
                </div>
                <div className="w-44 shrink-0">
                  <Select
                    value={it.statusFlag ?? 'none'}
                    onValueChange={v => {
                      const next = v === 'none' ? null : (v as ItemDraft['statusFlag'])
                      patchItem(idx, {
                        statusFlag: next,
                        pendingUntil: next === 'backordered' ? it.pendingUntil : null,
                      })
                    }}
                  >
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No issue</SelectItem>
                      <SelectItem value="out_of_stock">Out of stock</SelectItem>
                      <SelectItem value="backordered">Backordered</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {it.statusFlag === 'backordered' && (
                  <div className="w-36 shrink-0">
                    <Input
                      type="date"
                      value={it.pendingUntil ?? ''}
                      onChange={e => patchItem(idx, { pendingUntil: e.target.value || null })}
                      className="h-8 text-[12px]"
                      title="Pending until"
                    />
                  </div>
                )}
              </div>
              <Textarea
                value={it.notes}
                onChange={e => patchItem(idx, { notes: e.target.value })}
                rows={1}
                placeholder="Item notes (optional)"
                className="text-[13px]"
              />
              {it.statusFlag && ITEM_CHIPS_BY_STATUS[it.statusFlag].length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ITEM_CHIPS_BY_STATUS[it.statusFlag].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => addToItemNotes(idx, c)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              )}
              {it.statusFlag && (
                <div className="mt-2 text-[11px] text-slate-500">
                  Will show as <ItemStatusPill flag={it.statusFlag} pendingUntil={it.pendingUntil} /> on the queue row.
                </div>
              )}
            </div>
          ))}
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ItemStatusPill({
  flag,
  pendingUntil,
}: {
  flag: NonNullable<ItemDraft['statusFlag']>
  pendingUntil: string | null
}) {
  const tone: Record<NonNullable<ItemDraft['statusFlag']>, string> = {
    out_of_stock: 'bg-red-100 text-red-900 border-red-300',
    backordered: 'bg-amber-100 text-amber-900 border-amber-300',
    discontinued: 'bg-slate-700 text-white border-slate-700',
    other: 'bg-slate-200 text-slate-800 border-slate-300',
  }
  const label =
    flag === 'backordered' && pendingUntil
      ? `Backordered → ${pendingUntil}`
      : STATUS_LABELS[flag]
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${tone[flag]}`}
    >
      {label}
    </span>
  )
}
