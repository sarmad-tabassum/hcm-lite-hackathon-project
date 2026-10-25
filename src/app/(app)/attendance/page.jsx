'use client'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { LogIn, LogOut, MapPin, CalendarCheck } from 'lucide-react'
import { useGetAttendanceTodayQuery, useGetMyAttendanceQuery, useGetRegisterQuery, useCheckInMutation, useCheckOutMutation } from '@/store/services/attendanceApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, Loading, PageHeader } from '@/components/ui/bits'
import { fmtTime, workedHoursOf, karachiToday, cn } from '@/lib/utils'

const STATUS_COLORS = {
  present: 'bg-emerald-500',
  late: 'bg-amber-500',
  half_day: 'bg-orange-500',
  on_leave: 'bg-sky-500',
  absent: 'bg-red-400',
}

function MonthGrid({ rows, month, year }) {
  const byDate = new Map((rows || []).map((r) => [r.attendance_date, r]))
  const lastDay = new Date(year, month, 0).getDate()
  const days = Array.from({ length: lastDay }, (_, i) => {
    const d = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    const dt = new Date(d + 'T00:00:00Z')
    return { date: d, day: i + 1, weekend: [0, 6].includes(dt.getUTCDay()) }
  })
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {days.map((d) => {
          const row = byDate.get(d.date)
          const color = row ? STATUS_COLORS[row.status] : d.weekend ? 'bg-muted' : 'bg-muted/40'
          return (
            <div
              key={d.date}
              title={row ? `${d.date}: ${row.status}${row.notes ? ' · ' + row.notes : ''}` : `${d.date}: no record`}
              className={cn(
                'flex h-8 w-8 flex-col items-center justify-center rounded-md text-[11px] font-medium',
                color,
                row ? 'text-white' : 'text-muted-foreground'
              )}
            >
              {d.day}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {Object.entries({ present: 'Present', late: 'Late', half_day: 'Half day', on_leave: 'On leave', 'no record': 'No record' }).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm', STATUS_COLORS[k] || 'bg-muted/40')} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

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

  if (isLoading) return <Loading />
  if (!data?.employee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No employee record is linked to your account yet.</p>
        </CardContent>
      </Card>
    )
  }

  const done = row?.check_out

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today · {data.today}</CardTitle>
        <CardDescription>
          Office {company?.office_start?.slice(0, 5) || '09:00'}–{company?.office_end?.slice(0, 5) || '17:00'}
          {geofence ? ` · geofence ${company.radius || 100}m` : ' · no geofence'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.holiday && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            🎉 Today is a holiday — {data.holiday.name}. No attendance needed.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-36 rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Check in</p>
            <p className="text-lg font-semibold">{row?.check_in ? fmtTime(row.check_in) : '—'}</p>
          </div>
          <div className="min-w-36 rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Check out</p>
            <p className="text-lg font-semibold">{row?.check_out ? fmtTime(row.check_out) : '—'}</p>
          </div>
          {row && <StatusBadge status={row.status} />}
          {row?.notes && <span className="text-xs text-muted-foreground">{row.notes}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!row && (
            <Button onClick={doCheckIn} disabled={checkingIn || locating || !!data.holiday}>
              {locating ? <MapPin className="h-4 w-4 animate-pulse" /> : <LogIn />}
              {checkingIn ? 'Checking in…' : 'Check in'}
            </Button>
          )}
          {row && !done && (
            <Button variant="outline" onClick={doCheckOut} disabled={checkingOut}>
              <LogOut /> {checkingOut ? 'Checking out…' : 'Check out'}
            </Button>
          )}
          {done && (
            <Button variant="ghost" disabled>
              <CalendarCheck /> Day complete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RegisterCard() {
  const [date, setDate] = useState(karachiToday())
  const { data, isLoading } = useGetRegisterQuery({ date })

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Team register</CardTitle>
          <CardDescription>Daily attendance of all active employees</CardDescription>
        </div>
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-3">
        {data && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Present {data.summary.present}</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Late {data.summary.late}</span>
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">Half day {data.summary.half_day}</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">On leave {data.summary.on_leave}</span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">No record {data.summary.absent}</span>
          </div>
        )}
        {isLoading ? (
          <Loading />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows || []).map((r) => (
                <TableRow key={r.employee.id}>
                  <TableCell>
                    <p className="font-medium leading-tight">{r.employee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{r.employee.employee_code}</p>
                  </TableCell>
                  <TableCell>{r.employee.department}</TableCell>
                  <TableCell>{r.att?.check_in ? fmtTime(r.att.check_in) : '—'}</TableCell>
                  <TableCell>{r.att?.check_out ? fmtTime(r.att.check_out) : '—'}</TableCell>
                  <TableCell>{workedHoursOf(r.att) != null ? `${workedHoursOf(r.att)}h` : '—'}</TableCell>
                  <TableCell><StatusBadge status={r.att?.status || 'absent'} /></TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{r.att?.notes || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default function AttendancePage() {
  const profile = useSelector((s) => s.auth.profile)
  const now = new Date()
  const [month] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())
  const isPrivileged = ['admin', 'hr'].includes(profile?.role)

  const { data: mine } = useGetMyAttendanceQuery({ month, year }, { skip: !profile?.company_id })

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" desc="Check in/out · late after 09:15 · under 5h = half day" />
      <TodayCard />
      {mine && (
        <Card>
          <CardHeader>
            <CardTitle>My month — {new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthGrid rows={mine.rows} month={month} year={year} />
          </CardContent>
        </Card>
      )}
      {isPrivileged && <RegisterCard />}
    </div>
  )
}
