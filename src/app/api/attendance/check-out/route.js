import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { karachiNow } from '@/lib/time'

// POST /api/attendance/check-out — computes worked hours; < 5h = half day
export async function POST(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { profile, user } = g

  const { data: employee } = await supabaseAdmin
    .from('employees').select('id').eq('profile_id', user.id).maybeSingle()
  if (!employee) return bad('No employee record is linked to your account')

  const now = karachiNow()
  const { data: row } = await supabaseAdmin
    .from('attendance').select('*').eq('employee_id', employee.id).eq('attendance_date', now.date).maybeSingle()
  if (!row?.check_in) return bad('You have not checked in today')
  if (row.check_out) return bad('You have already checked out today')

  const workedMin = (Date.now() - new Date(row.check_in).getTime()) / 60000
  const workedHours = Math.round((workedMin / 60) * 100) / 100
  const status = workedHours < 5 ? 'half_day' : row.status // late stays late, else present

  const h = Math.floor(workedMin / 60)
  const m = Math.round(workedMin % 60)
  const parts = []
  if (row.notes) parts.push(row.notes)
  parts.push(`Worked ${h}h ${m}m`)
  if (status === 'half_day') parts.push('Half day (<5h)')

  // NOTE: worked hours are derived from check_in/check_out timestamps — no extra column needed
  const { data: updated, error } = await supabaseAdmin
    .from('attendance')
    .update({ check_out: new Date().toISOString(), status, notes: parts.join(' · ') })
    .eq('id', row.id)
    .select()
    .single()
  if (error) return bad(error.message, 500)

  await logAudit(profile, 'attendance.check_out', 'attendance', row.id, { status, notes: parts.join(' · ') }, null, req)
  return json({ row: updated, worked_hours: workedHours })
}
