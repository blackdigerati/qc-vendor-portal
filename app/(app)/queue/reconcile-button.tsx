'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type Diff = {
  orderNumber: string
  ssShipmentIds: string[]
  matched: number
  added: { sku: string; name: string; qty: number; unitCostCents: number }[]
  removed: { id: string; sku: string; name: string; qty: number }[]
  qtyChanged: { id: string; sku: string; name: string; portalQty: number; ssQty: number }[]
}

export function ReconcileButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [diff, setDiff] = useState<Diff | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function openAndLoad() {
    setOpen(true)
    setLoading(true)
    setDiff(null)
    setError(null)
    const r = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/reconcile-ss`)
    setLoading(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Reconcile failed' }))
      setError(error || 'Reconcile failed')
      return
    }
    setDiff(await r.json())
  }

  async function apply() {
    setApplying(true)
    const r = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/reconcile-ss`, { method: 'POST' })
    setApplying(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Apply failed' }))
      toast.error(error || 'Apply failed')
      return
    }
    const d = await r.json()
    toast.success(`Reconciled — added ${d.addedCount}, removed ${d.removedCount}, qty changed on ${d.qtyChangedCount}`)
    setOpen(false)
    setDiff(null)
    router.refresh()
  }

  const hasChanges = !!diff && (diff.added.length + diff.removed.length + diff.qtyChanged.length) > 0

  return (
    <>
      <button
        type="button"
        onClick={openAndLoad}
        className="text-slate-500 hover:text-emerald-700 p-0.5 rounded hover:bg-white"
        title="Reconcile this order against ShipStation"
        aria-label="Reconcile against ShipStation"
      >
        <RefreshCw className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">Reconcile #{orderNumber} against ShipStation</DialogTitle>
            <DialogDescription>
              Pulls the SS shipment items for this order and compares them to what&apos;s in the portal queue. Apply to bring portal in line with what was actually shipped (e.g. OOS substitutions).
            </DialogDescription>
          </DialogHeader>

          {loading && <div className="text-[13px] text-slate-500 py-8 text-center">Loading SS shipment…</div>}
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-900">{error}</div>
          )}

          {diff && (
            <div className="space-y-3 text-[13px]">
              <div className="text-[12px] text-slate-600">
                Matched <span className="font-medium text-slate-900">{diff.matched}</span> item(s). Shipment(s): {diff.ssShipmentIds.map(id => <span key={id} className="font-mono text-[11px] ml-1">{id}</span>)}
              </div>

              {!hasChanges && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
                  ✓ Portal and ShipStation are in sync — no changes.
                </div>
              )}

              {diff.added.length > 0 && (
                <section className="border border-emerald-300 rounded-md overflow-hidden">
                  <header className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 text-[11px] uppercase tracking-wider font-semibold text-emerald-900">
                    Add to portal ({diff.added.length}) — present on SS but not in queue
                  </header>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {diff.added.map((a, i) => (
                        <tr key={i} className="border-t border-emerald-200">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 w-32">{a.sku || 'no-sku'}</td>
                          <td className="px-3 py-1.5">{a.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums w-16">×{a.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {diff.removed.length > 0 && (
                <section className="border border-red-300 rounded-md overflow-hidden">
                  <header className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-[11px] uppercase tracking-wider font-semibold text-red-900">
                    Cancel in portal ({diff.removed.length}) — in queue but not on SS shipment
                  </header>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {diff.removed.map(r => (
                        <tr key={r.id} className="border-t border-red-200">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 w-32">{r.sku || 'no-sku'}</td>
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums w-16">×{r.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {diff.qtyChanged.length > 0 && (
                <section className="border border-amber-300 rounded-md overflow-hidden">
                  <header className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] uppercase tracking-wider font-semibold text-amber-900">
                    Qty change ({diff.qtyChanged.length}) — portal will be updated to match SS
                  </header>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {diff.qtyChanged.map(c => (
                        <tr key={c.id} className="border-t border-amber-200">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 w-32">{c.sku || 'no-sku'}</td>
                          <td className="px-3 py-1.5">{c.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums w-32 text-slate-700">
                            {c.portalQty} → <span className="font-semibold text-slate-900">{c.ssQty}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={applying}>Close</Button>
            {diff && hasChanges && (
              <Button onClick={apply} disabled={applying} className="bg-emerald-600 hover:bg-emerald-700">
                {applying ? 'Applying…' : 'Apply changes'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
