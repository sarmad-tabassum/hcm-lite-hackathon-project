'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Hourglass, ShieldCheck, FileCheck2, UserRound, Building2,
  LogOut, ArrowRight, CircleCheckBig, XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useDispatch } from 'react-redux'
import { api } from '@/store/apiBase'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * /approval — the waiting room for self-registered HR & employee accounts.
 *
 * Registration does NOT open the dashboard: an admin must approve the
 * account first. This page polls /api/auth/me every few seconds and flips
 * to "approved" the moment the decision lands (no refresh needed). If the
 * admin rejects, the account is removed and the session dies — we explain
 * that here instead of showing a dead error.
 */

const POLL_MS = 5000

function Timeline({ approved }) {
  const steps = [
    { icon: FileCheck2, label: 'Request submitted', desc: 'Your account was created with a valid join code', done: true },
    { icon: Hourglass, label: 'Waiting for admin approval', desc: 'Your company admin reviews new accounts', done: !approved, active: !approved },
    { icon: ShieldCheck, label: approved ? 'Approved' : 'Approval', desc: approved ? 'Full access unlocked' : 'You get portal access instantly after approval', done: approved },
  ]
  return (
    <ol className="relative ml-3 space-y-5 border-l-2 border-border">
      {steps.map((s) => (
        <li key={s.label} className="relative flex items-start gap-3 pl-5">
          <span
            className={`absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card ${
              s.done
                ? 'border-emerald-500/60 text-emerald-600 dark:text-emerald-400'
                : s.active
                  ? 'animate-pulse border-amber-500/70 text-amber-600 dark:text-amber-400'
                  : 'border-border text-muted-foreground'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
          </span>
          <div className="pt-0.5">
            <p className={`text-sm font-medium ${s.done || s.active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function ApprovalPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const [state, setState] = useState('loading') // loading | pending | approved | gone
  const [info, setInfo] = useState(null) // { role, email, company }
  const timer = useRef(null)

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null } }

  const check = useCallback(async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (res.status === 401) {
        // Session dead → either rejected (account deleted) or an expired token
        await supabase.auth.signOut().catch(() => {})
        setState('gone')
        stop()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data?.approval_status === 'pending') {
        setInfo({
          role: data.profile?.role || 'staff',
          email: data.profile?.email || '',
          company: data.profile?.companies?.name || null,
        })
        setState('pending')
      } else if (data?.approval_status === 'approved') {
        setInfo({
          role: data.profile?.role || 'staff',
          email: data.profile?.email || '',
          company: data.profile?.companies?.name || null,
        })
        setState('approved')
        stop()
        // Drop the stale "pending" Me cache so the app layout does not bounce
        // the user straight back here after the redirect (infinite-loop guard).
        dispatch(api.util.invalidateTags(['Me']))
        // Auto-continue after a short celebration beat
        setTimeout(() => router.replace(data.profile?.role === 'employee' ? '/portal' : '/dashboard'), 2200)
      } else {
        setState('pending')
      }
    } catch {
      /* transient network hiccup — keep polling */
    }
  }, [router, dispatch])

  useEffect(() => {
    let alive = true
    async function boot() {
      const { data: s } = await supabase.auth.getSession()
      if (!alive) return
      if (!s?.session) { router.replace('/login'); return }
      await check(s.session.access_token)
      if (!alive) return
      timer.current = setInterval(async () => {
        const { data: s2 } = await supabase.auth.getSession()
        if (s2?.session) check(s2.session.access_token)
      }, POLL_MS)
    }
    boot()
    return () => { alive = false; stop() }
  }, [check, router])

  async function signOut() {
    stop()
    await supabase.auth.signOut().catch(() => {})
    router.replace('/login')
  }

  const roleTone = info?.role === 'employee'
    ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
    : 'bg-sky-500/15 text-sky-600 dark:text-sky-300'

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
        <CardHeader className="text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${
            state === 'approved'
              ? 'bg-emerald-100 dark:bg-emerald-500/15'
              : state === 'gone'
                ? 'bg-rose-100 dark:bg-rose-500/15'
                : 'bg-amber-100 dark:bg-amber-500/15'
          }`}>
            {state === 'approved' ? (
              <CircleCheckBig className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            ) : state === 'gone' ? (
              <XCircle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            ) : (
              <Hourglass className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <CardTitle className="text-xl">
            {state === 'approved' ? 'You are approved!' : state === 'gone' ? 'Request no longer active' : 'Waiting for admin approval'}
          </CardTitle>
          <CardDescription>
            {state === 'approved'
              ? 'Your account was approved. Taking you to your workspace…'
              : state === 'gone'
                ? 'Your sign-up request was removed by the admin, or the session expired. If you believe this is a mistake, sign up again with the correct join code or contact your admin.'
                : 'Your account is created but locked until an admin approves it. This page updates itself — you do not need to refresh.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {info && state !== 'gone' && (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground"><UserRound className="h-4 w-4" /> Account</span>
                <span className="flex items-center gap-2 font-medium">
                  {info.email}
                  <Badge className={`border-0 capitalize ${roleTone}`}>{info.role}</Badge>
                </span>
              </div>
              {info.company && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4" /> Company</span>
                  <span className="font-medium">{info.company}</span>
                </div>
              )}
            </div>
          )}

          {state === 'pending' && <Timeline approved={false} />}
          {state === 'approved' && <Timeline approved />}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {state === 'approved' ? (
              <Button onClick={() => router.replace(info?.role === 'employee' ? '/portal' : '/dashboard')}>
                Continue to workspace <ArrowRight className="h-4 w-4" />
              </Button>
            ) : state === 'gone' ? (
              <>
                <Link href="/login" className={buttonVariants()}><LogOut className="h-4 w-4" /> Back to sign in</Link>
                <Link href="/signup/employee" className={cn(buttonVariants({ variant: 'outline' }))}>Sign up again</Link>
              </>
            ) : (
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out of this device
              </Button>
            )}
          </div>

          {state === 'pending' && (
            <p className="text-center text-xs text-muted-foreground">
              Tip: your admin approves new accounts from the dashboard. You will be signed in
              automatically once approved — keep this tab open.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
