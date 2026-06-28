import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { LogoutButton } from './logout-button'
import { NavLink } from './nav-link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession()
  const isAdmin = s.role === 'admin'
  const nav: { href: string; label: string; adminOnly?: boolean }[] = [
    { href: '/queue', label: 'Queue' },
    { href: '/merge-report', label: 'Merge' },
    { href: '/batches', label: 'Batches' },
    { href: '/billing', label: 'Billing' },
    { href: '/ledger', label: 'Ledger' },
    { href: '/payments', label: 'Payments' },
    { href: '/out-of-stock', label: 'Out of Stock' },
    { href: '/returns', label: 'Returns' },
    { href: '/settings/skus', label: 'Settings', adminOnly: true },
  ]
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-slate-100 border-b border-slate-950 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 h-12">
          <div className="flex items-center gap-8">
            <Link href="/queue" className="font-semibold tracking-tight text-white text-[15px]">
              QC <span className="text-slate-400 font-normal">/ Vendor Portal</span>
            </Link>
            <nav className="flex items-center gap-0.5 text-[13px]">
              {nav.filter(n => !n.adminOnly || isAdmin).map(n => (
                <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-slate-300">
            <span className="text-slate-400">{s.email}</span>
            <span className="text-slate-600">·</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-5 py-5">{children}</main>
      <Toaster richColors closeButton position="top-right" />
    </div>
  )
}
