import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { karachiNow } from '@/lib/time'

// GET /api/attendance/today — caller's own attendance row for today
export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e

  const { data: employee } = await supabaseAdmin
    .from('employees').select('id, employee_code').eq('profile_id', g.user.id).maybeSingle()
  if (!employee) return json({ employee: null, row: null, holiday: null })

  const now = karachiNow()
  const [{ data: row }, { data: holiday }] = await Promise.all([
    supabaseAdmin
      .from('attendance').select('*').eq('employee_id', employee.id).eq('attendance_date', now.date).maybeSingle(),
    supabaseAdmin
      .from('holidays').select('name').eq('company_id', g.profile.company_id).eq('holiday_date', now.date).maybeSingle(),
  ])
  return json({ employee, row: row || null, holiday: holiday || null, today: now.date })
}
