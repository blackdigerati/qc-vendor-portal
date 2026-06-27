'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname() || ''
  const active = href === '/queue' ? path === '/queue' : path.startsWith(href.split('/').slice(0, 2).join('/'))
  return (
    <Link
      href={href}
      className={
        'px-3 h-12 inline-flex items-center border-b-2 transition-colors ' +
        (active
          ? 'border-emerald-400 text-white font-medium'
          : 'border-transparent text-slate-300 hover:text-white hover:border-slate-600')
      }
    >
      {children}
    </Link>
  )
}
