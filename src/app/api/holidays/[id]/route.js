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
  if (body.holiday_date) patch.holiday_date = body.holiday_date
  if ('description' in body) patch.description = body.description
  const { data, error } = await supabaseAdmin
    .from('holidays').update(patch).eq('id', id).eq('company_id', g.profile.company_id).select().single()
  if (error || !data) return bad(error?.message || 'Not found', 404)
  await logAudit(g.profile, 'holiday.update', 'holidays', id, patch, null, req)
  return json({ holiday: data })
}

export async function DELETE(req, ctx) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const { error } = await supabaseAdmin
    .from('holidays').delete().eq('id', id).eq('company_id', g.profile.company_id)
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'holiday.delete', 'holidays', id, null, null, req)
  return json({ ok: true })
}
