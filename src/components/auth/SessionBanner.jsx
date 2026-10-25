'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

/**
 * Shown at the top of every login/signup page.
 *
 * Fixes the "I sign in and land back on the login page" dead-end: if a valid
 * session already exists (tab restored, back-button, or a hiccup after
 * sign-in), the user sees a one-tap "Continue" bar instead of being asked to
 * type credentials again. "Use another account" signs out cleanly for
 * intentional account switching.
 */
export default function SessionBanner() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const s = data?.session
      if (!s || !alive) return
      setSession(s)
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${s.access_token}` } })
        if (res.ok) {
          const j = await res.json()
          if (alive) setProfile(j.profile || null)
        }
      } catch {}
    })()
    return () => { alive = false }
  }, [])

  if (!session || dismissed) return null

  async function destination() {
    const p = profile
    if (!p || !p.role) return '/dashboard'
    if (!p.company_id) return p.role === 'admin' ? '/setup' : '/pending'
    if (p.role === 'employee') return '/portal'
    return '/dashboard'
  }

  async function go() {
    router.replace(await destination())
  }

  async function switchAccount() {
    setSigningOut(true)
    await supabase.auth.signOut()
    setSession(null)
    setSigningOut(false)
    setDismissed(true)
  }

  const roleLabel = { admin: 'Admin', hr: 'HR', employee: 'Employee' }[profile?.role] || ''

  return (
    <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{session.user?.email}</span>
          {roleLabel ? ` · signed in as ${roleLabel}` : ' · already signed in'}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={go}>Continue to your workspace</Button>
          <Button size="sm" variant="ghost" onClick={switchAccount} disabled={signingOut}>
            {signingOut ? 'Switching…' : 'Use another account'}
          </Button>
        </div>
      </div>
    </div>
  )
}
