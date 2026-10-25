import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { karachiNow } from '@/lib/time'

// GET /api/attendance/register?date=YYYY-MM-DD — full team register (admin, hr)
export async function GET(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || karachiNow().date

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select(`id, employee_code, status, departments(name), profile:profiles(full_name),
      attendance(attendance_date, check_in, check_out, status, notes)`)
    .eq('company_id', g.profile.company_id)
    .eq('status', 'active')
    .eq('attendance.attendance_date', date)
    .order('employee_code')
  if (error) return bad(error.message, 500)

  const rows = (data || []).map((emp) => ({
    employee: {
      id: emp.id,
      employee_code: emp.employee_code,
      full_name: emp.profile?.full_name || emp.employee_code,
      department: emp.departments?.name || '—',
    },
    att: emp.attendance?.[0] || null,
  }))

  const summary = { present: 0, late: 0, half_day: 0, on_leave: 0, absent: 0 }
  for (const r of rows) {
    if (!r.att) summary.absent++
    else summary[r.att.status] = (summary[r.att.status] || 0) + 1
  }
  return json({ date, rows, summary })
}
