import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { karachiNow, monthRange } from '@/lib/time'

// GET /api/attendance/me?month=&year= — caller's month attendance
export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e

  const { searchParams } = new URL(req.url)
  const now = karachiNow()
  const month = Number(searchParams.get('month')) || Number(now.date.slice(5, 7))
  const year = Number(searchParams.get('year')) || Number(now.date.slice(0, 4))

  const { data: employee } = await supabaseAdmin
    .from('employees').select('id').eq('profile_id', g.user.id).maybeSingle()
  if (!employee) return bad('No employee record linked to your account')

  const { start, end } = monthRange(year, month)
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('employee_id', employee.id)
    .gte('attendance_date', start)
    .lte('attendance_date', end)
    .order('attendance_date')
  if (error) return bad(error.message, 500)
  return json({ rows: data || [], month, year })
}
