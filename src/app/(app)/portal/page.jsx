'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  CalendarCheck, CalendarDays, Wallet, LogIn, LogOut, MapPin, Megaphone,
  ArrowRight, FileText, UserRound, Building2,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import {
  useGetAttendanceTodayQuery,
  useCheckInMutation, useCheckOutMutation,
} from '@/store/services/attendanceApi'
import { useGetDashboardQuery } from '@/store/services/dashboardApi'
import { useGetMyPayslipsQuery } from '@/store/services/payrollApi'
import { useGetLeaveRequestsQuery } from '@/store/services/leaveApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, Loading, EmptyState, PageHeader } from '@/components/ui/bits'
import { fmtDate, fmtTime, cn } from '@/lib/utils'
import { MONTHS } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ---------------- Today card with punch in / out ---------------- */
function TodayCard() {
  const profile = useSelector((s) => s.auth.profile)
  const company = profile?.companies
  const geofence = company?.latitude != null && company?.longitude != null
  const { data, isLoading, refetch } = useGetAttendanceTodayQuery(undefined, { skip: !profile?.company_id })
  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation()
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation()
  const [locating, setLocating] = useState(false)

  const row = data?.row

  function getCoords() {
    return new Promise((resolve) => {
      if (!geofence) return resolve({})
      if (!navigator.geolocation) {
        toast.error('Geolocation not supported')
        return resolve(null)
      }
      setLocating(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false)
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        },
        () => {
          setLocating(false)
          toast.error('Location permission denied — cannot verify geofence')
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  async function doCheckIn() {
    const coords = await getCoords()
    if (coords === null) return
    try {
      const res = await checkIn(coords).unwrap()
      toast.success(res.minutesLate > 0 ? `Checked in — ${res.minutesLate} min late` : 'Checked in on time')
      refetch()
    } catch (err) {
      toast.error(err?.data?.error || 'Check-in failed')
    }
  }

  async function doCheckOut() {
    try {
      const res = await checkOut({}).unwrap()
      toast.success(`Checked out — ${res.worked_hours}h logged`)
      refetch()
    } catch (err) {
      toast.error(err?.data?.error || 'Check-out failed')
    }
  }

  if (isLoading) return <Loading label="Loading today…" />

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" /> Today
          </CardTitle>
          <CardDescription>
            {data?.employee ? `EMP ${data.employee.employee_code}` : 'No employee record linked'}
            {geofence ? ' · geo-fenced office' : ''}
          </CardDescription>
        </div>
        {row ? <StatusBadge status={row.status} /> : <StatusBadge status="absent" />}
      </CardHeader>
      <CardContent className="space-y-4">
        {!data?.employee ? (
          <EmptyState
            icon={UserRound}
            title="No employee record linked"
            desc="Your admin needs to add you as an employee with this exact email. Until then attendance is disabled."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">Check in</p>
                <p className="text-lg font-semibold">{row?.check_in ? fmtTime(row.check_in) : '—'}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">Check out</p>
                <p className="text-lg font-semibold">{row?.check_out ? fmtTime(row.check_out) : '—'}</p>
              </div>
              <div className="flex flex-1 flex-wrap justify-end gap-2">
                {!row?.check_in ? (
                  <Button onClick={doCheckIn} disabled={checkingIn || locating}>
                    {locating ? <MapPin className="h-4 w-4 animate-pulse" /> : <LogIn className="h-4 w-4" />}
                    {checkingIn ? 'Checking in…' : 'Check in'}
                  </Button>
                ) : !row?.check_out ? (
                  <Button onClick={doCheckOut} disabled={checkingOut} variant="outline">
                    <LogOut className="h-4 w-4" />
                    {checkingOut ? 'Checking out…' : 'Check out'}
                  </Button>
                ) : (
                  <p className="self-center text-sm text-muted-foreground">Day complete — see you tomorrow</p>
                )}
              </div>
            </div>
            {geofence && !row?.check_in && (
              <p className="text-xs text-muted-foreground">
                Check-in works within <span className="font-medium">{company?.radius || 100}m</span> of the office location.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------- Leave balances ---------------- */
function BalancesCard({ balances, pendingCount }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Leave balance
          </CardTitle>
          <CardDescription>{pendingCount} request(s) pending</CardDescription>
        </div>
        <Link href="/leave">
          <Button size="sm" variant="outline">Apply <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {(balances || []).length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">No leave types configured yet</p>
        )}
        {(balances || []).map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="text-sm">{b.name}</span>
            <span className={cn('text-sm font-semibold', b.remaining <= 0 ? 'text-red-600' : 'text-primary')}>
              {b.remaining}/{b.quota} days
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ---------------- My leave requests ---------------- */
function MyLeavesCard() {
  const { data } = useGetLeaveRequestsQuery(undefined, { refetchOnWindowFocus: true })
  const mine = (data?.requests || []).slice(0, 5)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>My leave requests</CardTitle>
          <CardDescription>Latest five</CardDescription>
        </div>
        <Link href="/leave">
          <Button size="sm" variant="ghost">Manage</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {mine.length === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">No requests yet</p>
        )}
        {mine.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.leave_type?.name || 'Leave'}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ---------------- Recent attendance ---------------- */
function RecentAttendanceCard({ rows }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recent attendance</CardTitle>
          <CardDescription>Last records</CardDescription>
        </div>
        <Link href="/attendance">
          <Button size="sm" variant="ghost">Full register</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {(rows || []).length === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">No attendance marked yet</p>
        )}
        {(rows || []).slice(0, 6).map((r) => (
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
  )
}

/* ---------------- My payslips ---------------- */
function PayslipsCard() {
  const { data, isLoading } = useGetMyPayslipsQuery()
  const slips = (data?.slips || []).slice(0, 4)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> My payslips
          </CardTitle>
          <CardDescription>Salary history</CardDescription>
        </div>
        <Link href="/payroll">
          <Button size="sm" variant="ghost">View all</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loading />}
        {!isLoading && slips.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No payslips yet"
            desc="Once your admin runs payroll, your slips appear here."
            className="py-6"
          />
        )}
        {slips.map((s) => {
          const run = s.payroll_runs || {}
          return (
            <Link key={s.id} href="/payroll" className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-accent">
              <div>
                <p className="text-sm font-medium">
                  {MONTHS[Number(run.month) - 1] || run.month} {run.year}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gross {Number(s.gross).toLocaleString()} · Tax {Number(s.tax).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">PKR {Number(s.net).toLocaleString()}</p>
                <StatusBadge status={run.status || 'draft'} />
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

/* ---------------- Announcements ---------------- */
function AnnouncementsCard({ items }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(items || []).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No announcements yet</p>
        )}
        {(items || []).map((a) => (
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

/* ---------------- Page ---------------- */
export default function PortalPage() {
  const profile = useSelector((s) => s.auth.profile)
  const hasCompany = !!profile?.company_id
  const { data, isLoading } = useGetDashboardQuery(undefined, {
    skip: !hasCompany,
    refetchOnWindowFocus: true,
  })

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!hasCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Waiting to join a company"
        desc="Your account is not linked to a company yet. Ask your admin to add you as an employee with this exact email."
      />
    )
  }
  if (isLoading || !data) return <Loading label="Loading your space…" />

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${profile.full_name?.split(' ')[0]}`}
        desc={`${todayLabel} · ${profile.companies?.name || ''}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodayCard />
        </div>
        <BalancesCard balances={data.balances} pendingCount={data.pendingCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentAttendanceCard rows={data.recentAttendance} />
        <PayslipsCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MyLeavesCard />
        <AnnouncementsCard items={data.announcements} />
      </div>
    </div>
  )
}
