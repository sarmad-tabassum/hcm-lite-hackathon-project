import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { karachiNow, timeToMinutes, haversineMeters } from '@/lib/time'

// POST /api/attendance/check-in — server timestamp, late after office_start + 15m
export async function POST(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { profile, user } = g

  const { data: employee } = await supabaseAdmin
    .from('employees').select('id, employee_code').eq('profile_id', user.id).maybeSingle()
  if (!employee) return bad('No employee record is linked to your account. Ask HR to add you with your login email.')

  const now = karachiNow()
  const company = profile.companies

  // Holiday check
  const { data: holiday } = await supabaseAdmin
    .from('holidays').select('id, name').eq('company_id', profile.company_id).eq('holiday_date', now.date).maybeSingle()
  if (holiday) return bad(`Today is a holiday (${holiday.name}) — no check-in needed`)

  // Already checked in?
  const { data: existing } = await supabaseAdmin
    .from('attendance').select('*').eq('employee_id', employee.id).eq('attendance_date', now.date).maybeSingle()
  if (existing?.check_in) return bad('You have already checked in today')

  // Optional geofence
  let lat = null, lng = null
  if (company?.latitude != null && company?.longitude != null) {
    let body = {}
    try { body = await req.json() } catch {}
    if (body.latitude == null || body.longitude == null)
      return bad('Location is required to check in (office geofence is active)')
    const dist = haversineMeters(body.latitude, body.longitude, company.latitude, company.longitude)
    const radius = company.radius || 100
    if (dist > radius) return bad(`You are ${Math.round(dist)}m away — outside the office radius of ${radius}m`)
    lat = body.latitude
    lng = body.longitude
  }

  const threshold = timeToMinutes(company?.office_start, 540) + 15
  const minutesLate = Math.max(0, now.minutes - threshold)
  const status = minutesLate > 0 ? 'late' : 'present'
  const notes = minutesLate > 0 ? `Late by ${minutesLate} min` : null

  const { data: row, error } = await supabaseAdmin
    .from('attendance')
    .insert({
      employee_id: employee.id,
      attendance_date: now.date,
      check_in: new Date().toISOString(),
      status,
      source: 'web',
      latitude: lat,
      longitude: lng,
      notes,
    })
    .select()
    .single()
  if (error) return bad(error.message, 500)

  await logAudit(profile, 'attendance.check_in', 'attendance', row.id, { date: now.date, status }, null, req)
  return json({ row, minutesLate })
}
