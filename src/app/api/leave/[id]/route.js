import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { workingDays } from '@/lib/leave'

// PATCH /api/leave/[id] — review (admin/hr) or cancel (owner, while pending)
export async function PATCH(req, ctx) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const body = await req.json()

  const { data: request } = await supabaseAdmin
    .from('leave_requests')
    .select('*, employees!inner(id, company_id, profile_id, employee_code)')
    .eq('id', id)
    .maybeSingle()
  if (!request || request.employees.company_id !== g.profile.company_id) return bad('Request not found', 404)
  if (!['pending', 'approved'].includes(request.status)) return bad('Only pending requests can be changed')

  const isPrivileged = ['admin', 'hr'].includes(g.profile.role)
  const isOwner = request.employees.profile_id === g.user.id

  // Cancel by owner
  if (body.status === 'cancelled') {
    if (!isOwner && !isPrivileged) return bad('Not allowed', 403)
    if (request.status !== 'pending') return bad('Only pending requests can be cancelled')
    const { error } = await supabaseAdmin.from('leave_requests').update({ status: 'cancelled' }).eq('id', id)
    if (error) return bad(error.message, 500)
    await logAudit(g.profile, 'leave.cancel', 'leave_requests', id, { status: 'cancelled' }, null, req)
    return json({ ok: true })
  }

  // Review by admin/hr
  if (!isPrivileged) return bad('Only admins and HR can review leave requests', 403)
  const newStatus = body.status
  if (!['approved', 'rejected'].includes(newStatus)) return bad('Invalid status')

  const { error: upErr } = await supabaseAdmin
    .from('leave_requests')
    .update({
      status: newStatus,
      reviewed_by: g.user.id,
      reviewed_at: new Date().toISOString(),
      review_note: body.review_note?.trim() || null,
    })
    .eq('id', id)
  if (upErr) return bad(upErr.message, 500)

  // On approve → mark attendance as on_leave for working days in range
  if (newStatus === 'approved') {
    const y1 = Number(request.start_date.slice(0, 4))
    const y2 = Number(request.end_date.slice(0, 4))
    const { data: hols } = await supabaseAdmin
      .from('holidays').select('holiday_date')
      .eq('company_id', g.profile.company_id)
      .gte('holiday_date', `${Math.min(y1, y2)}-01-01`)
      .lte('holiday_date', `${Math.max(y1, y2)}-12-31`)
    const holidaySet = new Set((hols || []).map((h) => h.holiday_date))
    const days = workingDays(request.start_date, request.end_date, holidaySet)

    for (const date of days) {
      const { data: existing } = await supabaseAdmin
        .from('attendance').select('id, check_in').eq('employee_id', request.employee_id).eq('attendance_date', date).maybeSingle()
      if (existing) {
        if (!existing.check_in) {
          await supabaseAdmin.from('attendance').update({ status: 'on_leave', notes: 'Approved leave' }).eq('id', existing.id)
        }
      } else {
        await supabaseAdmin.from('attendance').insert({
          employee_id: request.employee_id,
          attendance_date: date,
          status: 'on_leave',
          source: 'web',
          notes: 'Approved leave',
        })
      }
    }
  }

  // Notify the employee (if their profile is linked)
  if (request.employees.profile_id) {
    await supabaseAdmin.from('notifications').insert({
      user_id: request.employees.profile_id,
      title: `Leave ${newStatus}`,
      message: `Your ${request.start_date} → ${request.end_date} leave was ${newStatus}.${body.review_note ? ' Note: ' + body.review_note : ''}`,
      type: newStatus === 'approved' ? 'success' : 'warning',
    })
  }

  await logAudit(g.profile, `leave.${newStatus}`, 'leave_requests', id, { status: newStatus }, { status: request.status }, req)
  return json({ ok: true })
}
