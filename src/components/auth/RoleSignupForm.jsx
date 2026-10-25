'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BriefcaseBusiness, Users, UserRound, CalendarCheck, Wallet, Bot, Ticket, ShieldCheck, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/input'
import SessionBanner from './SessionBanner'
import ThemeToggle from '@/components/theme/ThemeToggle'

// Client-side mirror of the server password policy (src/lib/security.js)
function passwordProblem(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
    return 'Password needs an uppercase letter, a lowercase letter and a number'
  return null
}

const SIGNUPS = {
  admin: {
    label: 'Admin',
    title: 'Create your workspace',
    sub: 'Start a brand-new private company — or enter an ADMIN join code from an existing company to become its admin.',
    icon: BriefcaseBusiness,
    features: [
      { icon: Wallet, text: 'One-click payroll with slab tax' },
      { icon: Users, text: 'Invite HR & employees — real accounts' },
      { icon: ShieldCheck, text: 'Approve every new HR / employee account' },
      { icon: Bot, text: 'AI assistant on your own data' },
    ],
    panel: 'from-emerald-700 via-emerald-900 to-slate-950',
    chip: 'bg-emerald-500/15 text-emerald-300',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30',
    join: false,
    adminCode: true,
  },
  hr: {
    label: 'HR',
    title: 'Join as HR',
    sub: 'Create your HR account and manage people operations for your company.',
    icon: Users,
    features: [
      { icon: CalendarCheck, text: 'Attendance register & monthly grid' },
      { icon: Users, text: 'Employee directory & onboarding' },
      { icon: Wallet, text: 'Review payslips before finalizing' },
      { icon: Bot, text: 'Ask the AI about your team' },
    ],
    panel: 'from-sky-700 via-sky-900 to-slate-950',
    chip: 'bg-sky-500/15 text-sky-300',
    btn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/30',
    join: true,
  },
  employee: {
    label: 'Employee',
    title: 'Join as Employee',
    sub: 'Create your account — an admin approves it, then you can check in, apply for leave and view payslips.',
    icon: UserRound,
    features: [
      { icon: CalendarCheck, text: 'Punch in / out with late detection' },
      { icon: CalendarCheck, text: 'Apply for leave, track balance' },
      { icon: Wallet, text: 'View & print your payslips' },
      { icon: Bot, text: 'AI assistant for your own data' },
    ],
    panel: 'from-violet-700 via-violet-900 to-slate-950',
    chip: 'bg-violet-500/15 text-violet-300',
    btn: 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/30',
    join: true,
  },
}

// ⚠️ Admin signup lives at /signup (NOT /signup/admin — that 404s)
const SIGNUP_HREF = { admin: '/signup', hr: '/signup/hr', employee: '/signup/employee' }
const OTHER_SIGNUPS = {
  admin: [{ key: 'employee', label: 'Employee' }, { key: 'hr', label: 'HR' }],
  hr: [{ key: 'admin', label: 'Admin' }, { key: 'employee', label: 'Employee' }],
  employee: [{ key: 'admin', label: 'Admin' }, { key: 'hr', label: 'HR' }],
}

export default function RoleSignupForm({ mode }) {
  const cfg = SIGNUPS[mode]
  const Icon = cfg.icon
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showAdminCode, setShowAdminCode] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const pwErr = passwordProblem(password)
    if (pwErr) return toast.error(pwErr)
    if (cfg.join && !code.trim()) return toast.error(`The ${cfg.label} join code is required`)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          full_name: name.trim(),
          email: email.trim(),
          password,
          join_code: code.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          throw Object.assign(new Error(data.error || 'Already registered'), { already: true })
        }
        throw new Error(data.error || 'Could not create the account')
      }

      // Auto sign-in with the credentials just created (no email step involved)
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (sErr) {
        if (data.approval === 'pending') {
          toast.success('Account created! Sign in to follow your approval status.')
          router.replace(`/login/${mode}`)
        } else {
          toast.success('Account created! Please sign in.')
          router.replace(mode === 'admin' ? '/login/admin' : `/login/${mode}`)
        }
        return
      }

      // Pending staff → waiting room until the admin approves. Admins are
      // never pending: a valid admin join code (or a new workspace) IS the
      // authorization, so they go straight to the dashboard / setup.
      if (data.approval === 'pending') {
        toast.success('Account created — waiting for admin approval')
        router.replace('/approval')
        return
      }

      toast.success(`Welcome, ${name.trim().split(' ')[0]}!`)
      if (data.needs_setup) router.replace('/setup')
      else if (data.role === 'employee') router.replace('/portal')
      else router.replace('/dashboard')
    } catch (err) {
      toast.error(err.message, {
        action: err.already
          ? { label: 'Sign in', onClick: () => router.replace(mode === 'admin' ? '/login/admin' : `/login/${mode}`) }
          : undefined,
        duration: err.already ? 8000 : 5000,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SessionBanner />
      <ThemeToggle className="fixed bottom-4 right-4 z-50 shadow-lg shadow-black/10" />
      <div className="flex flex-1">
        {/* Brand panel */}
        <div className={`hidden lg:flex lg:w-[46%] flex-col justify-between bg-gradient-to-br ${cfg.panel} p-10 text-white`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">HCM Lite</span>
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.chip}`}>{cfg.label} signup</span>
          </div>
          <div className="animate-fade-up">
            <h1 className="text-3xl font-semibold leading-tight">{cfg.title}</h1>
            <ul className="mt-8 space-y-3.5">
              {cfg.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                  <span className="mt-0.5 rounded-lg bg-white/10 p-1.5">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">Saylani Hackathon · Next.js + Supabase + Redux Toolkit</p>
        </div>

        {/* Form */}
        <div className="animate-fade-up a-delay-1 flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.panel} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{cfg.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{cfg.sub}</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <Field label="Full name">
                <Input required placeholder={mode === 'admin' ? 'Ali Khan' : 'Your full name'} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" hint="Minimum 8 characters with upper & lower case letters and a number">
                <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {cfg.join && (
                <Field label={`${cfg.label} join code`} hint={mode === 'hr' ? 'Ask your company admin for the HR join code' : 'Ask your company admin for the Employee join code'}>
                  <div className="relative">
                    <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9 uppercase" required placeholder="HCM-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
                  </div>
                </Field>
              )}
              {cfg.adminCode && (
                <div className="rounded-xl border border-dashed border-border p-3">
                  <button
                    type="button"
                    onClick={() => setShowAdminCode((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Have an admin code from an existing company?
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showAdminCode ? 'rotate-180' : ''}`} />
                  </button>
                  {showAdminCode && (
                    <div className="mt-3 space-y-2">
                      <div className="relative">
                        <Ticket className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9 uppercase" placeholder="HCM-ADM-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Paste the ADMIN join code from that company's admin and you become an admin
                        of the same company. Leave it empty to start a fresh, fully separate company.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <Button type="submit" className={`w-full ${cfg.btn}`} disabled={busy}>
                {busy ? 'Creating…' : cfg.join ? `Join as ${cfg.label}` : 'Create account'}
              </Button>
              {mode === 'admin' && !showAdminCode && (
                <p className="text-center text-xs text-muted-foreground">
                  No code? Submit as-is — you become the admin of a brand-new company, fully separate from every other workspace.
                </p>
              )}
            </form>

            <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
              <p>
                Already have an account?{' '}
                <Link href={mode === 'admin' ? '/login/admin' : `/login/${mode}`} className="font-medium text-primary hover:underline">
                  Sign in as {cfg.label}
                </Link>
              </p>
              <p>
                Other signups:{' '}
                {OTHER_SIGNUPS[mode].map((o, i) => (
                  <span key={o.key}>
                    {i > 0 && ' · '}
                    <Link href={SIGNUP_HREF[o.key]} className="font-medium text-primary hover:underline">{o.label}</Link>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
