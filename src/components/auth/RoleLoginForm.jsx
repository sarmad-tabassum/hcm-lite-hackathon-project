'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BriefcaseBusiness, Users, UserRound, CalendarCheck, Wallet, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSyncUserMutation } from '@/store/services/authApi'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/input'
import SessionBanner from './SessionBanner'
import ThemeToggle from '@/components/theme/ThemeToggle'

// Per-portal self-registration link — each role signs up on its own page
const SIGNUP_LINK = {
  admin: { href: '/signup', label: 'Create a workspace' },
  hr: { href: '/signup/hr', label: 'Create an HR account' },
  employee: { href: '/signup/employee', label: 'Create an employee account' },
}

const PORTALS = {
  admin: {
    label: 'Admin Portal',
    name: 'Admin',
    icon: BriefcaseBusiness,
    role: 'admin',
    tagline: 'Run the whole workspace',
    features: [
      { icon: Wallet, text: 'Run & finalize payroll with slab tax' },
      { icon: Users, text: 'Add employees — each gets a real account' },
      { icon: CalendarCheck, text: 'Approve leaves, monitor attendance' },
      { icon: Bot, text: 'AI assistant grounded in your HR data' },
    ],
    panel: 'from-emerald-700 via-emerald-900 to-slate-950',
    chip: 'bg-emerald-500/15 text-emerald-300',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30',
  },
  hr: {
    label: 'HR Portal',
    name: 'HR',
    icon: Users,
    role: 'hr',
    tagline: 'People operations, day to day',
    features: [
      { icon: CalendarCheck, text: 'Attendance register & monthly grid' },
      { icon: Users, text: 'Employee directory & CSV onboarding' },
      { icon: Wallet, text: 'Review payslips before finalizing' },
      { icon: Bot, text: 'Ask the AI about your team' },
    ],
    panel: 'from-sky-700 via-sky-900 to-slate-950',
    chip: 'bg-sky-500/15 text-sky-300',
    btn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/30',
  },
  employee: {
    label: 'Employee Portal',
    name: 'Employee',
    icon: UserRound,
    role: 'employee',
    tagline: 'Your attendance, leave & payslips',
    features: [
      { icon: CalendarCheck, text: 'Punch in / out with late detection' },
      { icon: CalendarCheck, text: 'Apply for leave, track balance' },
      { icon: Wallet, text: 'View & print your payslips' },
      { icon: Bot, text: 'AI assistant for your own data' },
    ],
    panel: 'from-violet-700 via-violet-900 to-slate-950',
    chip: 'bg-violet-500/15 text-violet-300',
    btn: 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-600/30',
  },
}

export default function RoleLoginForm({ portal }) {
  const cfg = PORTALS[portal]
  const others = Object.entries(PORTALS).filter(([k]) => k !== portal)
  const Icon = cfg.icon
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncUser] = useSyncUserMutation()

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      const res = await syncUser({}).unwrap().catch(() => null)
      const profile = res?.profile
      if (profile && profile.role !== cfg.role) {
        await supabase.auth.signOut()
        throw new Error(`This is not an ${cfg.name} account. Please use the ${cfg.name} Portal instead.`)
      }
      // Route by account state — employees get their own self-service portal
      let dest = '/dashboard'
      if (profile) {
        if (!profile.company_id) dest = profile.role === 'admin' ? '/setup' : '/pending'
        else if (profile.role === 'employee') dest = '/portal'
      }
      toast.success('Welcome back!')
      router.replace(dest)
    } catch (err) {
      toast.error(err.message)
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
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.chip}`}>{cfg.label} portal</span>
          </div>
          <div className="animate-fade-up">
            <h1 className="text-3xl font-semibold leading-tight">{cfg.tagline}</h1>
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
            <h2 className="text-2xl font-semibold tracking-tight">{cfg.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your {cfg.name.toLowerCase()} account
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <Field label="Email">
                <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Button type="submit" className={`w-full ${cfg.btn}`} disabled={busy}>
                {busy ? 'Signing in…' : `Sign in as ${cfg.name}`}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
              <p>
                Other portals:{' '}
                {others.map(([key, o], i) => (
                  <span key={key}>
                    {i > 0 && ' · '}
                    <Link href={`/login/${key}`} className="font-medium text-primary hover:underline">{o.name}</Link>
                  </span>
                ))}
              </p>
              <p>
                <Link href="/login" className="hover:underline">← All portals</Link>
                {' · '}
                <Link href={SIGNUP_LINK[portal].href} className="font-medium text-primary hover:underline">{SIGNUP_LINK[portal].label}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
