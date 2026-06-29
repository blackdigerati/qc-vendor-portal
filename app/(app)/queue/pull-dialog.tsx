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

export function PullOrdersDialog({
  defaultSheetId = '',
  defaultSheetTab = 'Orders',
}: {
  defaultSheetId?: string
  defaultSheetTab?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'sheet' | 'upload'>(defaultSheetId ? 'sheet' : 'upload')
  const [file, setFile] = useState<File | null>(null)
  const [urgent, setUrgent] = useState('')
  const [sheetId, setSheetId] = useState(defaultSheetId)
  const [sheetTab, setSheetTab] = useState(defaultSheetTab)
  const [editingSheet, setEditingSheet] = useState(false)
  const [busy, setBusy] = useState(false)

  const usingConfiguredSheet = !!defaultSheetId && !editingSheet

  // Accept either a raw sheet ID or any Google Sheets URL. Extracts the long
  // alphanumeric ID between `/d/` and the next slash.
  function normalizeSheetIdInput(raw: string): string {
    const v = raw.trim()
    const m = v.match(/\/d\/([a-zA-Z0-9-_]+)/)
    return m ? m[1] : v
  }
  const normalizedSheetId = normalizeSheetIdInput(sheetId)
  const sheetIdLooksLikeUrl = /^https?:\/\//.test(sheetId.trim())

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
            sheetId: normalizedSheetId || undefined,
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
      setEditingSheet(false)
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
            Pull from the configured Google Sheet, or upload a 15-column Filtered CSV/XLSX.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={v => setTab(v as 'sheet' | 'upload')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="sheet">Google Sheet</TabsTrigger>
            <TabsTrigger value="upload">File upload</TabsTrigger>
          </TabsList>
          <TabsContent value="sheet" className="space-y-3 pt-3">
            {usingConfiguredSheet ? (
              <div className="border border-slate-300 rounded-md bg-slate-50 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Configured sheet</div>
                    <div className="text-[13px] text-slate-900 mt-0.5">
                      Tab <span className="font-mono font-semibold">{defaultSheetTab}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate" title={defaultSheetId}>
                      {defaultSheetId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSheet(true)}
                    className="text-[12px] text-slate-500 hover:text-emerald-700 underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sid">Sheet URL or ID</Label>
                    {defaultSheetId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSheet(false)
                          setSheetId(defaultSheetId)
                          setSheetTab(defaultSheetTab)
                        }}
                        className="text-[12px] text-slate-500 hover:text-emerald-700 underline"
                      >
                        Use configured
                      </button>
                    )}
                  </div>
                  <Input
                    id="sid"
                    placeholder="https://docs.google.com/spreadsheets/d/…/edit  —  or just the ID"
                    value={sheetId}
                    onChange={e => setSheetId(e.target.value)}
                  />
                  {sheetIdLooksLikeUrl && normalizedSheetId !== sheetId.trim() && (
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Detected sheet ID: <span className="font-mono">{normalizedSheetId}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Paste the full Google Sheets URL — the ID is extracted automatically.
                  </p>
                </div>
                <div>
                  <Label htmlFor="stab">Tab name</Label>
                  <Input id="stab" value={sheetTab} onChange={e => setSheetTab(e.target.value)} />
                </div>
              </>
            )}
          </TabsContent>
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
          <Button onClick={pull} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">{busy ? 'Pulling…' : 'Pull'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
