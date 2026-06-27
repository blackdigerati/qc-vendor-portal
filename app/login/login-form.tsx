'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!r.ok) {
      const { error: msg } = await r.json().catch(() => ({ error: 'Sign-in failed' }))
      setError(msg || 'Sign-in failed')
      return
    }
    router.push('/queue')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-white p-5 rounded-md border border-slate-300 shadow-xl">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-[13px] text-red-600">{error}</p>}
      <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
