import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { LogoutButton } from './logout-button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession()
  const isAdmin = s.role === 'admin'
  const nav: { href: string; label: string; adminOnly?: boolean }[] = [
    { href: '/queue', label: 'Queue' },
    { href: '/batches', label: 'Batches' },
    { href: '/merge-report', label: 'Merge' },
    { href: '/billing', label: 'Billing' },
    { href: '/ledger', label: 'Ledger' },
    { href: '/payments', label: 'Payments', adminOnly: true },
    { href: '/settings/skus', label: 'Settings', adminOnly: true },
  ]
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-6">
            <Link href="/queue" className="font-semibold tracking-tight">QC Vendor Portal</Link>
            <nav className="flex items-center gap-1 text-sm">
              {nav.filter(n => !n.adminOnly || isAdmin).map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{s.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
      <Toaster richColors closeButton position="top-right" />
    </div>
  )
}
