'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Users, UserCheck, Clock, CalendarDays, FileWarning, Wallet,
  Megaphone, ArrowRight, CalendarCheck, Bot, UserPlus, ShieldCheck, Check, X,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { useGetDashboardQuery } from '@/store/services/dashboardApi'
import { useCreateAnnouncementMutation } from '@/store/services/commsApi'
import { useGetApprovalsQuery, useDecideApprovalMutation } from '@/store/services/authApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatCard, StatusBadge, Loading, EmptyState } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Field } from '@/components/ui/input'
import { fmtDate, fmtTime, cn } from '@/lib/utils'
import { MONTHS } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function TrendBars({ trend, headcount }) {
  const max = Math.max(headcount, 1)
  return (
    <div className="flex h-40 items-end gap-2">
      {trend.map((t) => {
        const pct = Math.min(100, Math.round((t.present / max) * 100))
        return (
          <div key={t.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-32 w-full items-end rounded-md bg-muted/60">
              <div
                className={cn('w-full rounded-md transition-all', pct > 0 ? 'bg-primary' : 'bg-transparent')}
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${t.present} present on ${t.date}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{t.date.slice(8)}</span>
          </div>
        )
      })}
    </div>
  )
}

function DeptBars({ departments }) {
  const max = Math.max(1, ...departments.map((d) => d.count))
  return (
    <div className="space-y-3">
      {departments.map((d) => (
        <div key={d.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">{d.name}</span>
            <span className="text-muted-foreground">{d.count} {d.count === 1 ? 'person' : 'people'}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all" style={{ width: `${Math.round((d.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AnnouncementsCard({ data, canPost }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [createAnnouncement, { isLoading }] = useCreateAnnouncementMutation()
  const items = data?.announcements || []

  async function post() {
    if (!title.trim() || !content.trim()) return toast.error('Title and content are required')
    try {
      await createAnnouncement({ title, content }).unwrap()
      setTitle('')
      setContent('')
      toast.success('Announcement published')
    } catch (err) {
      toast.error(err?.data?.error || 'Failed to publish')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canPost && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Share an update with the team…" value={content} onChange={(e) => setContent(e.target.value)} />
            <Button size="sm" onClick={post} disabled={isLoading}>
              {isLoading ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        )}
        {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No announcements yet</p>}
        {items.map((a) => (
          <div key={a.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{a.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(String(a.published_at).slice(0, 10))}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{a.content}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">— {a.profiles?.full_name || 'Admin'}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ApprovalsCard() {
  const { data, isLoading } = useGetApprovalsQuery(undefined, { refetchOnWindowFocus: true })
  const [decide, { isLoading: deciding }] = useDecideApprovalMutation()
  const [busyId, setBusyId] = useState(null)
  const pending = data?.pending || []

  async function act(user_id, action, name) {
    setBusyId(user_id)
    try {
      await decide({ user_id, action }).unwrap()
      toast.success(action === 'approve' ? `${name} approved — they can sign in now` : `${name}'s request removed`)
    } catch (err) {
      toast.error(err?.data?.error || 'Action failed — try again')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Account approvals
          </CardTitle>
          <CardDescription>New HR / employee sign-ups waiting for your yes</CardDescription>
        </div>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            {pending.length} pending
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="py-3 text-center text-sm text-muted-foreground">Checking the queue…</p>}
        {!isLoading && pending.length === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">No accounts waiting — all clear</p>
        )}
        {pending.map((p) => (
          <div key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {p.full_name}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.role === 'hr' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'bg-violet-500/15 text-violet-700 dark:text-violet-300'}`}>
                  {p.role}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{p.email} · requested {p.requested_at ? new Date(p.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'recently'}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm" variant="success" disabled={deciding && busyId === p.user_id}
                onClick={() => act(p.user_id, 'approve', p.full_name)}
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm" variant="outline" disabled={deciding && busyId === p.user_id}
                className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                onClick={() => act(p.user_id, 'reject', p.full_name)}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const profile = useSelector((s) => s.auth.profile)
  const isPrivileged = ['admin', 'hr'].includes(profile?.role)
  const { data, isLoading } = useGetDashboardQuery(undefined, {
    skip: !profile?.company_id,
    refetchOnWindowFocus: true,
  })

  if (isLoading) return <Loading label="Loading dashboard…" />
  if (!data) return null

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting()}, {profile.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {isPrivileged ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Headcount" value={data.headcount} icon={Users} tone="default" sub="Active employees" />
            <StatCard label="Present" value={data.todayCounts.present} icon={UserCheck} tone="default" today="" />
            <StatCard label="Late today" value={data.todayCounts.late} icon={Clock} tone="warning" />
            <StatCard label="On leave" value={data.todayCounts.on_leave} icon={CalendarDays} tone="info" />
            <StatCard
              label="Pending approvals"
              value={data.pendingCount}
              icon={FileWarning}
              tone={data.pendingCount > 0 ? 'danger' : 'slate'}
            />
            <StatCard
              label={`Payroll ${MONTHS[Number(String(data.today).slice(5, 7)) - 1]?.slice(0, 3)}`}
              value={data.payroll ? data.payroll.totalNet.toLocaleString() : '—'}
              icon={Wallet}
              tone="purple"
              sub={data.payroll ? `${data.payroll.status} · ${data.payroll.employees} slips` : 'Not run yet'}
            />
          </div>

          {profile.role === 'admin' && <ApprovalsCard />}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Attendance this week</CardTitle>
                <CardDescription>Employees present (incl. late & half-day)</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendBars trend={data.trend} headcount={data.headcount} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team distribution</CardTitle>
                <CardDescription>Active employees by department</CardDescription>
              </CardHeader>
              <CardContent>
                {(data.byDepartment || []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No departments yet — add them in Organization</p>
                ) : (
                  <DeptBars departments={data.byDepartment} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/employees"><Button variant="outline" className="w-full justify-start"><UserPlus /> Add employees</Button></Link>
                <Link href="/payroll"><Button variant="outline" className="w-full justify-start"><Wallet /> Run payroll</Button></Link>
                <Link href="/assistant"><Button variant="outline" className="w-full justify-start"><Bot /> Ask the AI assistant</Button></Link>
                <Link href="/leave"><Button variant="outline" className="w-full justify-start"><FileWarning /> Review leave ({data.pendingCount})</Button></Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Pending leave requests</CardTitle>
                <CardDescription>Oldest first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.pendingList.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nothing pending 🎉</p>}
                {data.pendingList.map((p) => (
                  <Link key={p.id} href="/leave" className="block rounded-lg border p-2.5 hover:bg-accent">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{p.employee}</p>
                      <StatusBadge status="pending" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.type} · {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <div className="lg:col-span-2">
              <AnnouncementsCard data={data} canPost />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>My attendance today</CardTitle>
                  <CardDescription>{data.employee ? `EMP ${data.employee.employee_code}` : 'No employee record linked'}</CardDescription>
                </div>
                {data.today ? <StatusBadge status={data.today.status} /> : <StatusBadge status="absent" />}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-4">
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Check in</p>
                  <p className="text-lg font-semibold">{data.today?.check_in ? fmtTime(data.today.check_in) : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Check out</p>
                  <p className="text-lg font-semibold">{data.today?.check_out ? fmtTime(data.today.check_out) : '—'}</p>
                </div>
                <Link href="/attendance">
                  <Button><CalendarCheck /> Open attendance</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave balance</CardTitle>
                <CardDescription>{data.pendingCount} request(s) pending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data.balances || []).length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">No leave types configured yet</p>
                )}
                {(data.balances || []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{b.name}</span>
                    <span className={cn('text-sm font-semibold', b.remaining <= 0 ? 'text-red-600' : 'text-primary')}>
                      {b.remaining}/{b.quota} days
                    </span>
                  </div>
                ))}
                <Link href="/leave">
                  <Button variant="outline" className="w-full justify-start">Apply for leave <ArrowRight /></Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>My recent attendance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(data.recentAttendance || []).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No attendance marked yet</p>
                )}
                {(data.recentAttendance || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{fmtDate(r.attendance_date)}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {r.check_in ? fmtTime(r.check_in) : '—'} → {r.check_out ? fmtTime(r.check_out) : '—'}
                      </span>
                      <StatusBadge status={r.status} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <AnnouncementsCard data={data} canPost={false} />
          </div>
        </>
      )}
    </div>
  )
}
