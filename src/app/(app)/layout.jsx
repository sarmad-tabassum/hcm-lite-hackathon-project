'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { useGetMeQuery, useSyncUserMutation } from '@/store/services/authApi'
import AppShell from '@/components/layout/AppShell'
import { Loading } from '@/components/ui/bits'

export default function AppGroupLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const sessionUser = useSelector((s) => s.auth.sessionUser)
  const authReady = useSelector((s) => s.auth.ready)
  const [syncUser] = useSyncUserMutation()

  const { data: meData, isFetching, refetch } = useGetMeQuery(undefined, { skip: !sessionUser })
  const profile = meData?.profile

  // Approval-wait safety: if this tab still holds a "pending" snapshot while
  // the user got approved elsewhere (waiting room auto-continues here), poll
  // until /auth/me reports fresh status so the routing rule below can let in.
  useEffect(() => {
    if (meData?.approval_status !== 'pending' || profile?.role === 'admin') return
    const t = setInterval(() => refetch(), 5000)
    return () => clearInterval(t)
  }, [meData?.approval_status, profile?.role, refetch])

  // Auto-create profile on first visit after signup (idempotent)
  useEffect(() => {
    if (sessionUser && meData && !meData.profile && !isFetching) {
      syncUser({}).then(() => refetch())
    }
  }, [sessionUser, meData, isFetching, syncUser, refetch])

  // Role/company/approval routing rules — wait until the session check settles
  useEffect(() => {
    if (!authReady) return
    if (!sessionUser) {
      router.replace('/login')
      return
    }
    if (!profile) return
    // SECURITY: pending (admin-unapproved) staff accounts never see app pages —
    // their APIs are also blocked server-side; this is the UX mirror of that gate.
    if (meData?.approval_status === 'pending' && profile.role !== 'admin') {
      if (pathname !== '/approval') router.replace('/approval')
      return
    }
    if (!profile.company_id) {
      if (profile.role === 'admin' && pathname !== '/setup') router.replace('/setup')
      if (profile.role !== 'admin' && pathname !== '/pending') router.replace('/pending')
    } else {
      if (pathname === '/setup' || pathname === '/pending' || pathname === '/approval') {
        router.replace(profile.role === 'employee' ? '/portal' : '/dashboard')
      }
      // Employees live in their own self-service portal, not the admin dashboard
      if (profile.role === 'employee' && pathname === '/dashboard') router.replace('/portal')
    }
  }, [sessionUser, profile, pathname, router, authReady, meData])

  if (!sessionUser || !meData || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Loading workspace…" />
      </div>
    )
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
