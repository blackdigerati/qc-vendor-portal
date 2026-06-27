import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function RootPage() {
  const s = await getSession()
  redirect(s.userId ? '/queue' : '/login')
}
