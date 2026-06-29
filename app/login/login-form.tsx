'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ERROR_LABELS: Record<string, string> = {
  invalid: 'That sign-in link is invalid.',
  expired: 'That sign-in link expired. Request a new one.',
  'already used': 'That sign-in link has already been used. Request a new one.',
  user_removed: 'Your account is no longer active. Ask the admin to re-add you.',
}

export function LoginForm({ error }: { error: string | null }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/magic/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-white p-5 rounded-md border border-slate-300 shadow-xl text-center">
        <div className="text-3xl mb-2">📬</div>
        <h2 className="text-base font-semibold text-slate-900">Check your email</h2>
        <p className="text-[13px] text-slate-600 mt-1">
          If <span className="font-medium text-slate-900">{email}</span> is on the access list, a sign-in link is on its way.
          The link expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setEmail('') }}
          className="mt-4 text-[13px] text-slate-500 hover:text-slate-900 underline"
        >
          Send to a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-white p-5 rounded-md border border-slate-300 shadow-xl">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-900">
          {ERROR_LABELS[error] || 'Could not sign you in. Try again.'}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
      </div>
      <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading || !email}>
        {loading ? 'Sending…' : 'Send sign-in link'}
      </Button>
      <p className="text-[11px] text-slate-500 text-center pt-1">
        You&apos;ll receive an email with a one-time link. No password needed.
      </p>
    </form>
  )
}
