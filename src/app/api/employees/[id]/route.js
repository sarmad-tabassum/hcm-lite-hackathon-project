import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function PATCH(req, ctx) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const body = await req.json()

  const { data: old } = await supabaseAdmin
    .from('employees').select('*').eq('id', id).eq('company_id', g.profile.company_id).maybeSingle()
  if (!old) return bad('Employee not found', 404)

  // Name/email/phone live on the member's profile; org fields on the employee row
  const profilePatch = {}
  if (body.full_name) profilePatch.full_name = body.full_name.trim()
  if ('email' in body && body.email?.trim()) profilePatch.email = body.email.trim().toLowerCase()
  if ('phone' in body) profilePatch.phone = body.phone?.trim() || null

  if (Object.keys(profilePatch).length) {
    if (!old.profile_id) return bad('No account is linked to this employee yet')
    if (profilePatch.email) {
      const { data: taken } = await supabaseAdmin
        .from('profiles').select('id').eq('email', profilePatch.email).neq('id', old.profile_id).maybeSingle()
      if (taken) return bad('That email is already used by another account')
    }
    const { error: pErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', old.profile_id)
    if (pErr) return bad(pErr.message, 500)
  }

  const patch = {}
  if ('department_id' in body) patch.department_id = body.department_id || null
  if ('designation_id' in body) patch.designation_id = body.designation_id || null
  if (body.joining_date) patch.joining_date = body.joining_date
  if ('basic_salary' in body) patch.basic_salary = Number(body.basic_salary) || 0
  if (body.status) patch.status = body.status

  let data = old
  if (Object.keys(patch).length) {
    const { data: updated, error } = await supabaseAdmin.from('employees').update(patch).eq('id', id).select().single()
    if (error) return bad(error.message, 500)
    data = updated
  }
  await logAudit(g.profile, 'employee.update', 'employees', id, { ...patch, ...profilePatch }, old, req)
  return json({ employee: data })
}

// DELETE = soft terminate (admin only)
export async function DELETE(req, ctx) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  if (id === g.profile.employee_id) return bad('Invalid target')
  const { data: emp } = await supabaseAdmin
    .from('employees').select('id, status').eq('id', id).eq('company_id', g.profile.company_id).maybeSingle()
  if (!emp) return bad('Employee not found', 404)
  const { error } = await supabaseAdmin.from('employees').update({ status: 'terminated' }).eq('id', id)
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'employee.terminate', 'employees', id, { status: 'terminated' }, emp, req)
  return json({ ok: true })
}
