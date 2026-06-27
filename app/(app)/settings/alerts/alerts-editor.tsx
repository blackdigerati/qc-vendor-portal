'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type AlertRow = { id: string; email: string; eventType: 'new_orders' | 'new_invoice' }

const LABELS = {
  new_orders: 'New orders pulled',
  new_invoice: 'New invoice ready',
} as const

export function AlertsEditor({ initial }: { initial: AlertRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<AlertRow[]>(initial)
  const [saving, setSaving] = useState(false)

  function addRow(eventType: AlertRow['eventType']) {
    setRows([...rows, { id: 'new_' + Math.random().toString(36).slice(2), email: '', eventType }])
  }
  function patch(idx: number, fields: Partial<AlertRow>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...fields } : r)))
  }
  function remove(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    const r = await fetch('/api/settings/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: rows.map(r => ({ email: r.email, eventType: r.eventType })) }),
    })
    setSaving(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Save failed')
      return
    }
    toast.success('Saved')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {(['new_orders', 'new_invoice'] as const).map(et => (
        <div key={et} className="bg-white border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{LABELS[et]}</h2>
            <Button variant="outline" size="sm" onClick={() => addRow(et)}>+ Add</Button>
          </div>
          <div className="space-y-2">
            {rows.filter(r => r.eventType === et).map((r) => {
              const idx = rows.indexOf(r)
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={r.email}
                    onChange={e => patch(idx, { email: e.target.value })}
                    placeholder="name@example.com"
                  />
                  <Select value={r.eventType} onValueChange={v => patch(idx, { eventType: (v as AlertRow['eventType']) || 'new_orders' })}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_orders">{LABELS.new_orders}</SelectItem>
                      <SelectItem value="new_invoice">{LABELS.new_invoice}</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => remove(idx)} className="text-slate-400 hover:text-red-600 px-2">×</button>
                </div>
              )
            })}
            {rows.filter(r => r.eventType === et).length === 0 && (
              <p className="text-sm text-slate-400">No recipients.</p>
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </div>
  )
}
