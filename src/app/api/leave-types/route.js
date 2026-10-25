import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  // Readable by every role — employees need it for the leave apply form
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { data, error } = await supabaseAdmin
    .from('leave_types').select('*').eq('company_id', g.profile.company_id).order('name')
  if (error) return bad(error.message, 500)
  return json({ leaveTypes: data || [] })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.name?.trim()) return bad('Leave type name is required')
  const { data, error } = await supabaseAdmin
    .from('leave_types')
    .insert({
      company_id: g.profile.company_id,
      name: body.name.trim(),
      days_allowed: Number(body.days_allowed) || 0,
      is_paid: body.is_paid !== false,
    })
    .select().single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'leave_type.create', 'leave_types', data.id, data, null, req)
  return json({ leaveType: data })
}
