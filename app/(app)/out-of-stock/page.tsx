import { inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db/client'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  out_of_stock: { label: 'Out of stock', tone: 'bg-red-100 text-red-900 border-red-300' },
  backordered: { label: 'Backordered', tone: 'bg-amber-100 text-amber-900 border-amber-300' },
  discontinued: { label: 'Discontinued', tone: 'bg-slate-700 text-white border-slate-700' },
  other: { label: 'Other', tone: 'bg-slate-200 text-slate-800 border-slate-300' },
}

export default async function OutOfStockPage() {
  // Pull items that carry a status flag (deduped by SKU later)
  const flaggedItems = db
    .select()
    .from(schema.orderItems)
    .where(isNotNull(schema.orderItems.statusFlag))
    .all()

  // Group by SKU; one row per SKU showing latest status + which orders have it
  type Group = {
    sku: string
    name: string
    flag: string
    pendingUntil: Date | null
    notes: string
    orderCount: number
    orderNumbers: string[]
  }
  const bySku = new Map<string, Group>()
  for (const it of flaggedItems) {
    if (!it.sku) continue
    const g = bySku.get(it.sku)
    if (g) {
      g.orderCount++
      if (!g.orderNumbers.includes(it.orderNumber)) g.orderNumbers.push(it.orderNumber)
    } else {
      bySku.set(it.sku, {
        sku: it.sku,
        name: it.name,
        flag: it.statusFlag || 'other',
        pendingUntil: it.pendingUntil as Date | null,
        notes: it.notes,
        orderCount: 1,
        orderNumbers: [it.orderNumber],
      })
    }
  }

  const groups = [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku))

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Out of Stock</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {groups.length} SKU{groups.length === 1 ? '' : 's'} currently flagged across the queue.
          </p>
        </div>
        <Button disabled className="bg-slate-400 cursor-not-allowed" title="Not implemented — placeholder for v1">
          Update store catalog (coming soon)
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[12px] text-amber-900">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-800 mr-2">Placeholder</span>
        This screen lists every SKU currently flagged on any queued order. The &quot;Update store catalog&quot; action will eventually push these statuses to WooCommerce / Shopify in one click. Not wired yet.
      </div>

      <div className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="w-10 px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left font-semibold w-40">SKU</th>
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-left font-semibold w-36">Status</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Pending until</th>
              <th className="px-3 py-2 text-left font-semibold">Notes</th>
              <th className="px-3 py-2 text-right font-semibold w-20">Orders</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No SKUs are flagged right now.</td></tr>
            )}
            {groups.map(g => {
              const s = STATUS_LABELS[g.flag] || STATUS_LABELS.other
              return (
                <tr key={g.sku} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-1.5">
                    <input type="checkbox" disabled className="size-[18px] rounded-[4px] border-2 border-slate-400 opacity-60" title="Not wired" />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[12px]">{g.sku}</td>
                  <td className="px-3 py-1.5 text-slate-700">{g.name}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${s.tone}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 tabular-nums">
                    {g.pendingUntil ? g.pendingUntil.toLocaleDateString() : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-[12px]">
                    {g.notes ? <span className="italic" title={g.notes}>“{g.notes.length > 60 ? g.notes.slice(0, 57) + '…' : g.notes}”</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {g.orderCount}
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
