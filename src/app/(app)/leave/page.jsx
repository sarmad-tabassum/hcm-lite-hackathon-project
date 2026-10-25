'use client'
import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { CalendarDays, CheckCircle2, XCircle, Ban } from 'lucide-react'
import { useGetLeaveRequestsQuery, useApplyLeaveMutation, useReviewLeaveMutation, useCancelLeaveMutation } from '@/store/services/leaveApi'
import { useGetLeaveTypesQuery, useGetHolidaysQuery } from '@/store/services/orgApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Field, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, Loading, EmptyState, PageHeader } from '@/components/ui/bits'
import { fmtDate } from '@/lib/utils'
import { workingDays, WEEKEND_DAYS } from '@/lib/leave'

function LoadError({ error }) {
  return (
    <EmptyState
      icon={XCircle}
      title="Could not load leave requests"
      desc={error?.data?.error || 'Database error — make sure PATCH.sql was run in the Supabase SQL Editor (adds employee name columns).'}
    />
  )
}

function ApplyCard() {
  const { data: typesData } = useGetLeaveTypesQuery()
  const { data: holsData } = useGetHolidaysQuery()
  const [applyLeave, { isLoading }] = useApplyLeaveMutation()
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' })

  const types = typesData?.leaveTypes || []
  const holidaySet = useMemo(() => new Set((holsData?.holidays || []).map((h) => h.holiday_date)), [holsData])

  const days = useMemo(() => {
    if (!form.start_date || !form.end_date) return null
    return workingDays(form.start_date, form.end_date, holidaySet).length
  }, [form.start_date, form.end_date, holidaySet])

  async function submit(e) {
    e.preventDefault()
    try {
      const res = await applyLeave(form).unwrap()
      toast.success(`Request submitted — ${res.days} working day(s), pending approval`)
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' })
    } catch (err) {
      toast.error(err?.data?.error || 'Could not submit request')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply for leave</CardTitle>
        <CardDescription>Weekends and company holidays are not counted. Quota and overlap are validated.</CardDescription>
      </CardHeader>
      <CardContent>
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave types configured yet — ask your admin.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Leave type">
                <Select required value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.days_allowed}d/yr)</option>
                  ))}
                </Select>
              </Field>
              <Field label="From">
                <Input required type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </Field>
              <Field label="To">
                <Input required type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </Field>
            </div>
            {days != null && (
              <p className={`text-sm ${days === 0 ? 'text-destructive' : 'text-primary'}`}>
                {days === 0 ? 'No working days in this range (only weekends/holidays).' : `${days} working day(s) will be requested.`}
              </p>
            )}
            <Field label="Reason (optional)">
              <Textarea placeholder="Family event, medical…" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </Field>
            <Button type="submit" disabled={isLoading || days === 0}>{isLoading ? 'Submitting…' : 'Submit request'}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function ReviewButtons({ request }) {
  const [reviewLeave, { isLoading }] = useReviewLeaveMutation()
  const [note, setNote] = useState('')

  async function review(status) {
    try {
      await reviewLeave({ id: request.id, status, review_note: note }).unwrap()
      toast.success(`Request ${status}`)
    } catch (err) {
      toast.error(err?.data?.error || 'Failed')
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="h-8 w-44 text-xs" placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" variant="success" disabled={isLoading} onClick={() => review('approved')}>
        <CheckCircle2 /> Approve
      </Button>
      <Button size="sm" variant="destructive" disabled={isLoading} onClick={() => review('rejected')}>
        <XCircle /> Reject
      </Button>
    </div>
  )
}

function RequestsTable({ requests, canCancel }) {
  const [cancelLeave] = useCancelLeaveMutation()

  async function cancel(id) {
    try {
      await cancelLeave(id).unwrap()
      toast.success('Request cancelled')
    } catch (err) {
      toast.error(err?.data?.error || 'Failed')
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Review note</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.employee.full_name}</TableCell>
            <TableCell>{r.leave_type?.name || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">
              {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
            </TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{r.review_note || ''}</TableCell>
            <TableCell className="text-right">
              {r.status === 'pending' && canCancel && r.employee.is_me && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancel(r.id)}>
                  <Ban /> Cancel
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function LeavePage() {
  const profile = useSelector((s) => s.auth.profile)
  const isPrivileged = ['admin', 'hr'].includes(profile?.role)
  const [tab, setTab] = useState(isPrivileged ? 'approvals' : 'mine')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: pendingData, isLoading: loadingPending, error: pendingErr } = useGetLeaveRequestsQuery({ status: 'pending' }, { skip: !isPrivileged })
  const { data: allData, isLoading: loadingAll, error: allErr } = useGetLeaveRequestsQuery({ status: statusFilter })
  const pending = pendingData?.requests || []
  const all = allData?.requests || []
  const mine = all.filter((r) => r.employee.is_me)

  return (
    <div className="space-y-4">
      <PageHeader title="Leave" desc="Quota-checked · overlap-safe · holidays & weekends excluded" />

      <ApplyCard />

      {isPrivileged ? (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Requests</CardTitle>
            <Tabs
              tabs={[
                { value: 'approvals', label: 'Approvals', count: pending.length },
                { value: 'all', label: 'All' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {tab === 'approvals' &&
              (pendingErr ? (
                <LoadError error={pendingErr} />
              ) : loadingPending ? (
                <Loading />
              ) : pending.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Nothing to approve" desc="All leave requests have been reviewed." />
              ) : (
                <div className="space-y-2.5">
                  {pending.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {r.employee.full_name} <span className="text-xs text-muted-foreground">({r.employee.employee_code} · {r.employee.department})</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.leave_type?.name} · {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                            {r.reason ? ` · "${r.reason}"` : ''}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-2.5">
                        <ReviewButtons request={r} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            {tab === 'all' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Filter:</Label>
                  <Select className="w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>
                {allErr ? <LoadError error={allErr} /> : loadingAll ? <Loading /> : all.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No requests</p> : <RequestsTable requests={all} />}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>My requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAll ? (
              <Loading />
            ) : mine.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No requests yet" desc="Apply using the form above." />
            ) : (
              <RequestsTable requests={mine} canCancel />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
