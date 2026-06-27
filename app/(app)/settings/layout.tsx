import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

const items = [
  { href: '/settings/skus', label: 'SKUs & pricing' },
  { href: '/settings/alerts', label: 'Alert recipients' },
  { href: '/settings/opening-balance', label: 'Opening balance' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>
      <div className="grid grid-cols-[200px_1fr] gap-8">
        <nav className="space-y-1 text-sm">
          {items.map(i => (
            <Link
              key={i.href}
              href={i.href}
              className="block px-3 py-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
