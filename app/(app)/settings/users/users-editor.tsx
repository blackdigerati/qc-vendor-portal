'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type UserRow = {
  id: string
  email: string
  role: 'vendor' | 'admin'
  createdAt: string
  isSelf: boolean
}

export function UsersEditor({ initial }: { initial: UserRow[] }) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'vendor' | 'admin'>('vendor')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!newEmail) return
    setBusy(true)
    const r = await fetch('/api/settings/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, role: newRole }),
    })
    setBusy(false)
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    toast.success(`Added ${newEmail} (${newRole})`)
    setNewEmail('')
    setNewRole('vendor')
    router.refresh()
  }

  async function remove(row: UserRow) {
    if (!confirm(`Remove ${row.email}? They'll immediately lose access.`)) return
    const r = await fetch(`/api/settings/users?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
    if (!r.ok) {
      const { error } = await r.json().catch(() => ({ error: 'Failed' }))
      toast.error(error || 'Failed')
      return
    }
    toast.success(`Removed ${row.email}`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-300 rounded-md p-4 shadow-sm">
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Add a user</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="w-40">
            <Label htmlFor="role">Role</Label>
            <Select value={newRole} onValueChange={v => setNewRole((v as 'vendor' | 'admin') || 'vendor')}>
              <SelectTrigger id="role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={busy || !newEmail} className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </section>

      <section className="bg-white border border-slate-300 rounded-md shadow-sm overflow-hidden">
        <header className="px-3 py-1.5 bg-slate-100 border-b border-slate-300 text-[11px] uppercase tracking-wider font-semibold text-slate-600">
          {initial.length} user{initial.length === 1 ? '' : 's'}
        </header>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-slate-100 text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-left font-semibold w-28">Role</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Added</th>
              <th className="px-3 py-2 text-right w-24"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map(u => (
              <tr key={u.id} className="border-t border-slate-200">
                <td className="px-3 py-1.5">
                  {u.email}
                  {u.isSelf && <span className="ml-2 text-[10px] uppercase tracking-wide bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">you</span>}
                </td>
                <td className="px-3 py-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${u.role === 'admin' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-200 text-slate-800'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-600 tabular-nums">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-1.5 text-right">
                  {!u.isSelf && (
                    <button onClick={() => remove(u)} className="text-[12px] text-red-600 hover:text-red-800 hover:underline">Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
