import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function PATCH(req, ctx) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const body = await req.json()
  const patch = {}
  if (body.name) patch.name = body.name.trim()
  if ('days_allowed' in body) patch.days_allowed = Number(body.days_allowed) || 0
  if ('is_paid' in body) patch.is_paid = !!body.is_paid
  const { data, error } = await supabaseAdmin
    .from('leave_types').update(patch).eq('id', id).eq('company_id', g.profile.company_id).select().single()
  if (error || !data) return bad(error?.message || 'Not found', 404)
  await logAudit(g.profile, 'leave_type.update', 'leave_types', id, patch, null, req)
  return json({ leaveType: data })
}

export async function DELETE(req, ctx) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const { error } = await supabaseAdmin
    .from('leave_types').delete().eq('id', id).eq('company_id', g.profile.company_id)
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'leave_type.delete', 'leave_types', id, null, null, req)
  return json({ ok: true })
}
