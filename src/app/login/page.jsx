'use client'
import Link from 'next/link'
import {
  BriefcaseBusiness, Users, UserRound, ArrowRight, Check,
  CalendarCheck, Wallet, Bot, MapPin, UserPlus,
} from 'lucide-react'
import SessionBanner from '@/components/auth/SessionBanner'
import ThemeToggle from '@/components/theme/ThemeToggle'

/**
 * /login — portal hub.
 *
 * Roles are strictly separated (Admin / HR / Employee each have their own
 * gated login), so this page is a choice experience, not another form:
 * pick your door → sign in on the branded portal. No competing CTAs.
 * Fully theme-aware: a light airy canvas in light mode, deep aurora in dark.
 */

const PORTALS = [
  {
    href: '/login/admin',
    name: 'Admin Portal',
    who: 'For workspace owners',
    tagline: 'Run the whole workspace',
    icon: BriefcaseBusiness,
    features: ['Payroll with slab tax', 'Employees & departments', 'AI on your HR data'],
    tile: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30',
    hover: 'hover:border-emerald-400/60 dark:hover:border-emerald-400/50 hover:shadow-2xl hover:shadow-emerald-500/20',
    cta: 'text-emerald-600 dark:text-emerald-300',
    sheen: 'from-emerald-400/10',
    signup: { href: '/signup', label: 'Create workspace' },
  },
  {
    href: '/login/hr',
    name: 'HR Portal',
    who: 'For people-ops staff',
    tagline: 'People operations, day to day',
    icon: Users,
    features: ['Attendance register', 'Leaves & holidays', 'CSV onboarding'],
    tile: 'bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-500/30',
    hover: 'hover:border-sky-400/60 dark:hover:border-sky-400/50 hover:shadow-2xl hover:shadow-sky-500/20',
    cta: 'text-sky-600 dark:text-sky-300',
    sheen: 'from-sky-400/10',
    signup: { href: '/signup/hr', label: 'Join as HR' },
  },
  {
    href: '/login/employee',
    name: 'Employee Portal',
    who: 'For team members',
    tagline: 'Your attendance, leave & payslips',
    icon: UserRound,
    features: ['Geo check-in / out', 'Apply for leave', 'View & print payslips'],
    tile: 'bg-gradient-to-br from-violet-400 to-violet-600 shadow-violet-500/30',
    hover: 'hover:border-violet-400/60 dark:hover:border-violet-400/50 hover:shadow-2xl hover:shadow-violet-500/20',
    cta: 'text-violet-600 dark:text-violet-300',
    sheen: 'from-violet-400/10',
    signup: { href: '/signup/employee', label: 'Join as employee' },
  },
]

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Ambient background — three soft aurora blobs + faint grid */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-float-slow absolute -left-24 -top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-600/20" />
        <div className="animate-float-slower absolute -right-24 top-1/3 h-[26rem] w-[26rem] rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-600/20" />
        <div className="animate-float-slow absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-600/15" />
        <div
          className="absolute inset-0 opacity-60 dark:opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in oklab, var(--foreground) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 7%, transparent) 1px, transparent 1px)',
            backgroundSize: '54px 54px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 30%, transparent 100%)',
          }}
        />
      </div>

      {/* Theme switch — top right */}
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10">
        <SessionBanner />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-12">
        {/* Brand header */}
        <div className="animate-fade-up flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <BriefcaseBusiness className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">HCM Lite</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back —{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-sky-600 to-violet-600 bg-clip-text text-transparent dark:from-emerald-300 dark:via-sky-300 dark:to-violet-300">
              choose your portal
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every role has its own secure door. Pick the portal that matches your account —
            your ID only works on its own portal.
          </p>
        </div>

        {/* Portal cards */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PORTALS.map((p, i) => {
            const Icon = p.icon
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`group animate-fade-up a-delay-${i + 1} relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white/70 p-6 shadow-sm shadow-black/[0.03] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:bg-white hover:shadow-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:hover:bg-white/[0.07] ${p.hover}`}
              >
                {/* sheen on hover */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${p.sheen} via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ${p.tile} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-5 w-5 -translate-x-1 text-muted-foreground/60 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">{p.name}</h2>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{p.who}</p>
                <p className="mt-2 text-sm text-foreground/80">{p.tagline}</p>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-muted-foreground/60" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center justify-between border-t border-black/[0.06] pt-4 dark:border-white/10">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${p.cta}`}>
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Create account row */}
        <div className="animate-fade-up a-delay-4 mt-10 flex flex-col items-center gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New here? Create an account</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {PORTALS.map((p) => {
              const Icon = p.icon
              return (
                <Link
                  key={p.signup.href}
                  href={p.signup.href}
                  className={`inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 px-4 py-2 text-sm text-foreground/80 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white ${p.hover}`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {p.signup.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="animate-fade-up a-delay-4 mt-12 flex flex-col items-center gap-1 pb-4 text-center">
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Geo attendance</span>
            <span className="inline-flex items-center gap-1.5"><Wallet className="h-3 w-3" /> Slab-tax payroll</span>
            <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-3 w-3" /> Leave workflows</span>
            <span className="inline-flex items-center gap-1.5"><Bot className="h-3 w-3" /> AI assistant</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50">Saylani Hackathon · Built with Next.js, Supabase & Redux Toolkit</p>
        </div>
      </div>
    </div>
  )
}
