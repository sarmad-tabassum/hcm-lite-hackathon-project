import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

// PATCH /api/roles/[id] — change a user's role (admin, cannot change own)
export async function PATCH(req, ctx) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const { role } = await req.json()

  if (!['admin', 'hr', 'employee'].includes(role)) return bad('Invalid role')
  if (id === g.profile.id) return bad('You cannot change your own role')

  const { data: target } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', id).eq('company_id', g.profile.company_id).maybeSingle()
  if (!target) return bad('User not found in your company', 404)

  const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', id)
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'role.update', 'profiles', id, { from: target.role, to: role }, null, req)
  return json({ ok: true })
}
