import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { karachiNow } from '@/lib/time'
import { workingDays } from '@/lib/leave'

// GET /api/leave?status= — employee: own; admin/hr: whole company
export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const isPrivileged = ['admin', 'hr'].includes(g.profile.role)

  let query = supabaseAdmin
    .from('leave_requests')
    .select(`id, start_date, end_date, reason, status, review_note, reviewed_at, created_at,
      leave_types(id, name, days_allowed, is_paid),
      employees!inner(id, employee_code, company_id, profile_id, departments(name), profiles(full_name))`)
    .eq('employees.company_id', g.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!isPrivileged) query = query.eq('employees.profile_id', g.user.id)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return bad(error.message, 500)

  const requests = (data || []).map((r) => ({
    id: r.id,
    start_date: r.start_date,
    end_date: r.end_date,
    reason: r.reason,
    status: r.status,
    review_note: r.review_note,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    leave_type: r.leave_types,
    employee: {
      id: r.employees.id,
      employee_code: r.employees.employee_code,
      full_name: r.employees.profiles?.full_name || r.employees.employee_code,
      department: r.employees.departments?.name || '—',
      is_me: r.employees.profile_id === g.user.id,
    },
  }))
  return json({ requests })
}

// POST /api/leave — apply (any role with a linked employee record)
export async function POST(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()

  const { data: employee } = await supabaseAdmin
    .from('employees').select('id').eq('profile_id', g.user.id).maybeSingle()
  if (!employee) return bad('No employee record is linked to your account')

  const { leave_type_id, start_date, end_date, reason } = body
  if (!leave_type_id || !start_date || !end_date) return bad('Leave type and dates are required')
  if (start_date > end_date) return bad('End date must be after start date')

  const now = karachiNow()
  if (start_date < now.date) return bad('Start date cannot be in the past')

  const { data: lt } = await supabaseAdmin
    .from('leave_types').select('id, name, days_allowed').eq('id', leave_type_id).eq('company_id', g.profile.company_id).maybeSingle()
  if (!lt) return bad('Invalid leave type', 404)

  // Holidays for the involved years (weekends always skipped)
  const y1 = Number(start_date.slice(0, 4))
  const y2 = Number(end_date.slice(0, 4))
  const { data: hols } = await supabaseAdmin
    .from('holidays').select('holiday_date')
    .eq('company_id', g.profile.company_id)
    .gte('holiday_date', `${Math.min(y1, y2)}-01-01`)
    .lte('holiday_date', `${Math.max(y1, y2)}-12-31`)
  const holidaySet = new Set((hols || []).map((h) => h.holiday_date))

  const days = workingDays(start_date, end_date, holidaySet)
  if (days.length === 0) return bad('Selected range has no working days (only weekends/holidays)')

  // Overlap check (pending + approved)
  const { data: overlapping } = await supabaseAdmin
    .from('leave_requests')
    .select('id')
    .eq('employee_id', employee.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', end_date)
    .gte('end_date', start_date)
  if ((overlapping || []).length > 0) return bad('You already have a request overlapping these dates')

  // Quota check (approved usage this year)
  const { data: approved } = await supabaseAdmin
    .from('leave_requests')
    .select('start_date, end_date')
    .eq('employee_id', employee.id)
    .eq('leave_type_id', leave_type_id)
    .eq('status', 'approved')
    .gte('start_date', `${y1}-01-01`)
    .lte('start_date', `${y1}-12-31`)
  const used = (approved || []).reduce((s, l) => s + workingDays(l.start_date, l.end_date, holidaySet).length, 0)
  const remaining = (lt.days_allowed || 0) - used
  if (days.length > remaining)
    return bad(`Insufficient ${lt.name} balance: ${remaining} day(s) remaining, requested ${days.length}`)

  const { data: request, error } = await supabaseAdmin
    .from('leave_requests')
    .insert({
      employee_id: employee.id,
      leave_type_id,
      start_date,
      end_date,
      reason: reason?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()
  if (error) return bad(error.message, 500)

  await logAudit(g.profile, 'leave.apply', 'leave_requests', request.id, { days: days.length, type: lt.name }, null, req)
  return json({ request, days: days.length })
}
