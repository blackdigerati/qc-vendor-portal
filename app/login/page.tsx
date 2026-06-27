import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const s = await getSession()
  if (s.userId) redirect('/queue')
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">QC Vendor Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
