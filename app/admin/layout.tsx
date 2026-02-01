import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/admin/verify'
import NotAuthorized from './NotAuthorized'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { authorized, error } = await verifyAdmin()

  // Not signed in - redirect to login (which is /apply based on the app structure)
  if (error === 'not_authenticated') {
    redirect('/apply')
  }

  // No profile found - also redirect to login
  if (error === 'no_profile') {
    redirect('/apply')
  }

  // Signed in but not admin - show 403
  if (!authorized) {
    return <NotAuthorized />
  }

  // Authorized - render children
  return <>{children}</>
}
