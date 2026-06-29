import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

const items = [
  { href: '/settings/skus', label: 'SKUs & pricing' },
  { href: '/settings/billing-rules', label: 'Billing rules' },
  { href: '/settings/alerts', label: 'Alert recipients' },
  { href: '/settings/users', label: 'Users & access' },
  { href: '/settings/opening-balance', label: 'Opening balance' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <div className="grid grid-cols-[180px_1fr] gap-4">
        <nav className="space-y-0.5 text-[13px] bg-white border border-slate-300 rounded-md shadow-sm p-1.5 h-fit">
          {items.map(i => (
            <Link
              key={i.href}
              href={i.href}
              className="block px-2.5 py-1.5 rounded text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  )
}
