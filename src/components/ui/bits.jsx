'use client'
import { Loader2 } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { cn } from '@/lib/utils'

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} />
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Spinner /> {label}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function EmptyState({ icon: Icon, title, desc, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 px-6 text-center', className)}>
      {Icon && (
        <div className="rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {desc && <p className="max-w-sm text-sm text-muted-foreground">{desc}</p>}
      {action}
    </div>
  )
}

export function Avatar({ name, url, className }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  if (url) {
    return <img src={url} alt={name} className={cn('h-9 w-9 rounded-full object-cover', className)} />
  }
  return (
    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white', className)}>
      {initials}
    </div>
  )
}

export function PageHeader({ title, desc, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

const TONES = {
  default: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-700',
  purple: 'bg-violet-100 text-violet-700',
}

export function StatCard({ label, value, icon: Icon, tone = 'default', sub }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn('rounded-lg p-2', TONES[tone] || TONES.default)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const STATUS_MAP = {
  present: ['success', 'Present'],
  late: ['warning', 'Late'],
  half_day: ['warning', 'Half Day'],
  on_leave: ['info', 'On Leave'],
  absent: ['danger', 'Absent'],
  holiday: ['muted', 'Holiday'],
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  cancelled: ['muted', 'Cancelled'],
  draft: ['muted', 'Draft'],
  finalized: ['success', 'Finalized'],
  active: ['success', 'Active'],
  inactive: ['muted', 'Inactive'],
  terminated: ['danger', 'Terminated'],
}

export function StatusBadge({ status }) {
  const [variant, label] = STATUS_MAP[status] || ['muted', status]
  return <Badge variant={variant}>{label}</Badge>
}
