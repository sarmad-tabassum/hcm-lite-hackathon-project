'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, Wallet, Building2,
  Bot, ScrollText, Menu, X, LogOut, BriefcaseBusiness, Settings, Home,
} from 'lucide-react'
import { Avatar } from '@/components/ui/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import NotificationsBell from './NotificationsBell'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { supabase } from '@/lib/supabaseClient'
import { clearAuth } from '@/store/features/authSlice'
import { api } from '@/store/apiBase'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/portal', label: 'My Space', icon: Home, roles: ['employee'] },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'hr'] },
  { href: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['admin', 'hr', 'employee'] },
  { href: '/leave', label: 'Leave', icon: CalendarDays, roles: ['admin', 'hr', 'employee'] },
  { href: '/payroll', label: 'Payroll', icon: Wallet, roles: ['admin', 'hr', 'employee'] },
  { href: '/org', label: 'Organization', icon: Building2, roles: ['admin'] },
  { href: '/assistant', label: 'AI Assistant', icon: Bot, roles: ['admin', 'hr', 'employee'] },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'hr', 'employee'] },
]

function NavList({ profile, pathname, onNavigate }) {
  const items = NAV.filter((n) => n.roles.includes(profile.role) && !(profile.role === 'admin' && !profile.company_id && n.href !== '/setup') && n.href !== '/setup')
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand({ profile }) {
  return (
    <div className="flex items-center gap-2.5 border-b px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <BriefcaseBusiness className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">HCM Lite</p>
        <p className="truncate text-xs text-muted-foreground">{profile.companies?.name || 'No company yet'}</p>
      </div>
    </div>
  )
}

function UserCard({ profile, onSignOut }) {
  return (
    <div className="border-t p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={profile.full_name} url={profile.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{profile.full_name}</p>
          <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="mt-0.5">
            {profile.role.toUpperCase()}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function AppShell({ profile, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useDispatch()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    dispatch(clearAuth())
    dispatch(api.util.resetApiState())
    router.replace('/login')
  }

  const current = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))

  const sidebar = (
    <div className="flex h-full flex-col bg-card">
      <Brand profile={profile} />
      <NavList profile={profile} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      <UserCard profile={profile} onSignOut={signOut} />
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <button
              className="absolute -right-10 top-3 rounded-md border bg-card p-1.5 shadow"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 hover:bg-accent lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="flex-1 truncate text-sm font-medium text-muted-foreground">{current?.label || 'HCM Lite'}</h2>
          <ThemeToggle />
          {profile.company_id && <NotificationsBell profile={profile} />}
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
