'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export function PullOrdersDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'upload' | 'sheet'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [urgent, setUrgent] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [sheetTab, setSheetTab] = useState('Orders')
  const [busy, setBusy] = useState(false)

  async function pull() {
    setBusy(true)
    try {
      let r: Response
      if (tab === 'upload') {
        if (!file) {
          toast.error('Choose a CSV or XLSX file')
          setBusy(false)
          return
        }
        const fd = new FormData()
        fd.append('file', file)
        fd.append('urgent_orders', urgent)
        r = await fetch('/api/orders/pull', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/orders/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'sheet',
            sheetId: sheetId || undefined,
            tab: sheetTab || undefined,
            urgent_orders: urgent.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean),
          }),
        })
      }
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: 'Pull failed' }))
        toast.error(error || 'Pull failed')
        return
      }
      const data = await r.json()
      toast.success(
        `Pulled ${data.ordersInserted} new orders (${data.urgentTotal} urgent). ${data.ordersSkipped} already in queue.` +
          (data.skusCreated?.length ? ` ${data.skusCreated.length} new SKU${data.skusCreated.length === 1 ? '' : 's'} added to catalog.` : ''),
      )
      setOpen(false)
      setFile(null)
      setUrgent('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Pull new orders</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pull new orders</DialogTitle>
          <DialogDescription>
            Upload the 15-column Filtered CSV/XLSX, or read from the configured Google Sheet tab.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={v => setTab(v as 'upload' | 'sheet')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="upload">File upload</TabsTrigger>
            <TabsTrigger value="sheet">Google Sheet</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="space-y-3 pt-3">
            <div>
              <Label htmlFor="file">File (.csv or .xlsx)</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </TabsContent>
          <TabsContent value="sheet" className="space-y-3 pt-3">
            <div>
              <Label htmlFor="sid">Sheet ID</Label>
              <Input id="sid" placeholder="defaults to GOOGLE_SHEET_ID env" value={sheetId} onChange={e => setSheetId(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="stab">Tab name</Label>
              <Input id="stab" value={sheetTab} onChange={e => setSheetTab(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>
        <div className="space-y-1.5">
          <Label htmlFor="urgent">Urgent order numbers (optional)</Label>
          <Textarea
            id="urgent"
            placeholder="One per line, or comma/space separated"
            value={urgent}
            onChange={e => setUrgent(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-slate-500">Orders with &quot;URGENT&quot; in the Notes column are auto-flagged. Add others here.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={pull} disabled={busy}>{busy ? 'Pulling…' : 'Pull'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
