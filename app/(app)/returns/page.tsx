import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const dynamic = 'force-dynamic'

export default function ReturnsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Returns</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          Log an order that&apos;s being returned. When vendor acks receipt of the items, the COG credits back to your outstanding balance.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[12px] text-amber-900">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-800 mr-2">Placeholder</span>
        Flow not wired yet: (1) admin enters an order # being returned, (2) vendor sees it in the &quot;Awaiting receipt&quot; list, (3) vendor acks receipt → the line-item COG totals (from the original invoice) post as a credit on the ledger.
      </div>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700">
          Log a return
        </header>
        <div className="p-4 space-y-3 max-w-md">
          <div>
            <Label htmlFor="ret-order">Order number being returned</Label>
            <Input id="ret-order" placeholder="e.g. 212629" disabled />
          </div>
          <div>
            <Label htmlFor="ret-reason">Reason (optional)</Label>
            <Input id="ret-reason" placeholder="e.g. wrong size, damaged in transit" disabled />
          </div>
          <Button disabled className="bg-slate-400 cursor-not-allowed" title="Not implemented — placeholder for v1">
            Log return (coming soon)
          </Button>
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center justify-between">
          <span>Awaiting vendor receipt</span>
          <span className="text-slate-500">0</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-32">Logged</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Reason</th>
              <th className="px-3 py-2 text-right font-semibold w-28">COG to credit</th>
              <th className="px-3 py-2 text-right font-semibold w-32"></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No pending returns.</td></tr>
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-700 flex items-center justify-between">
          <span>Received</span>
          <span className="text-slate-500">0</span>
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold w-32">Received</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Reason</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Credited</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">No returns received yet.</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
