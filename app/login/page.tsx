import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const s = await getSession()
  if (s.userId) redirect('/queue')
  const sp = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">QC Vendor Portal</h1>
          <p className="text-[13px] text-slate-400 mt-1">Sign in with a magic link.</p>
        </div>
        <LoginForm error={sp.error ?? null} />
      </div>
    </div>
  )
}
