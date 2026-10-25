import { requireRole, needCompany, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { karachiNow, monthRange } from '@/lib/time'
import { workingDays } from '@/lib/leave'

// GET /api/dashboard — one role-shaped aggregate payload (M7)
export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const cid = g.profile.company_id
  const now = karachiNow()
  const isPrivileged = ['admin', 'hr'].includes(g.profile.role)

  // Shared: announcements
  const { data: announcements } = await supabaseAdmin
    .from('announcements')
    .select('id, title, content, published_at, profiles(full_name)')
    .eq('company_id', cid)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(5)

  if (!isPrivileged) {
    const { data: me } = await supabaseAdmin
      .from('employees').select('id, employee_code').eq('profile_id', g.user.id).maybeSingle()

    if (!me) {
      return json({ role: 'employee', employee: null, announcements: announcements || [] })
    }

    const [{ data: todayRow }, { data: recent }, { data: types }, { data: approved }, { data: hols }, { data: pending }] =
      await Promise.all([
        supabaseAdmin.from('attendance').select('*').eq('employee_id', me.id).eq('attendance_date', now.date).maybeSingle(),
        supabaseAdmin.from('attendance').select('*').eq('employee_id', me.id).order('attendance_date', { ascending: false }).limit(7),
        supabaseAdmin.from('leave_types').select('id, name, days_allowed').eq('company_id', cid).order('name'),
        supabaseAdmin.from('leave_requests').select('leave_type_id, start_date, end_date').eq('employee_id', me.id).eq('status', 'approved')
          .gte('start_date', `${now.date.slice(0, 4)}-01-01`),
        supabaseAdmin.from('holidays').select('holiday_date').eq('company_id', cid).gte('holiday_date', `${now.date.slice(0, 4)}-01-01`),
        supabaseAdmin.from('leave_requests').select('id').eq('employee_id', me.id).eq('status', 'pending'),
      ])
    const holidaySet = new Set((hols || []).map((h) => h.holiday_date))
    const balances = (types || []).map((t) => {
      const used = (approved || [])
        .filter((l) => l.leave_type_id === t.id)
        .reduce((s, l) => s + workingDays(l.start_date, l.end_date, holidaySet).length, 0)
      return { id: t.id, name: t.name, quota: t.days_allowed, used, remaining: (t.days_allowed || 0) - used }
    })

    return json({
      role: 'employee',
      employee: me,
      today: todayRow || null,
      recentAttendance: recent || [],
      balances,
      pendingCount: (pending || []).length,
      announcements: announcements || [],
    })
  }

  // Admin / HR
  const { start: monthStart, end: monthEnd } = monthRange(
    Number(now.date.slice(0, 4)),
    Number(now.date.slice(5, 7))
  )
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  const [{ count: headcount }, { data: todayRows }, { count: pendingCount }, { data: pendingList }, { data: monthAtt }, { data: run }, { data: byDept }] =
    await Promise.all([
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', cid).eq('status', 'active'),
      supabaseAdmin.from('attendance').select('status, employees!inner(company_id)').eq('employees.company_id', cid).eq('attendance_date', now.date),
      supabaseAdmin.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('employees.company_id', cid),
      supabaseAdmin.from('leave_requests')
        .select('id, start_date, end_date, leave_types(name), employees(employee_code, profiles(full_name))')
        .eq('status', 'pending').eq('employees.company_id', cid)
        .order('created_at').limit(5),
      supabaseAdmin.from('attendance').select('attendance_date, status, employees!inner(company_id)')
        .eq('employees.company_id', cid).gte('attendance_date', monthStart).lte('attendance_date', monthEnd),
      supabaseAdmin.from('payroll_runs').select('id, status, month, year').eq('company_id', cid)
        .eq('month', Number(now.date.slice(5, 7))).eq('year', Number(now.date.slice(0, 4))).maybeSingle(),
      supabaseAdmin.from('employees').select('id, departments(name)').eq('company_id', cid).eq('status', 'active'),
    ])

  const todayCounts = { present: 0, late: 0, half_day: 0, on_leave: 0 }
  for (const r of todayRows || []) todayCounts[r.status] = (todayCounts[r.status] || 0) + 1

  const trend = last7.map((date) => {
    const rows = (monthAtt || []).filter((a) => a.attendance_date === date)
    const present = rows.filter((r) => ['present', 'late', 'half_day'].includes(r.status)).length
    return { date, present, marked: rows.length }
  })

  let payroll = null
  if (run) {
    const { data: slips } = await supabaseAdmin
      .from('payslips').select('net').eq('payroll_run_id', run.id)
    payroll = {
      status: run.status,
      employees: (slips || []).length,
      totalNet: (slips || []).reduce((s, p) => s + (Number(p.net) || 0), 0),
    }
  }

  const deptCounts = {}
  for (const e of byDept || []) {
    const name = e.departments?.name || 'Unassigned'
    deptCounts[name] = (deptCounts[name] || 0) + 1
  }
  const byDepartment = Object.entries(deptCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return json({
    role: g.profile.role,
    headcount: headcount || 0,
    today: now.date,
    todayCounts,
    byDepartment,
    pendingCount: pendingCount || 0,
    pendingList: (pendingList || []).map((p) => ({
      id: p.id,
      employee: p.employees?.profiles?.full_name || p.employees?.employee_code,
      code: p.employees?.employee_code,
      type: p.leave_types?.name,
      start_date: p.start_date,
      end_date: p.end_date,
    })),
    payroll,
    trend,
    announcements: announcements || [],
  })
}
