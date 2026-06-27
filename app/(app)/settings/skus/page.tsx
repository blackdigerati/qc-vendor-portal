import { requireAdmin } from '@/lib/auth'
export const dynamic = 'force-dynamic'
export default async function SkusPage() {
  await requireAdmin()
  return <div><h1 className="text-2xl font-semibold tracking-tight">SKUs</h1><p className="text-sm text-slate-500 mt-1">Coming next.</p></div>
}
