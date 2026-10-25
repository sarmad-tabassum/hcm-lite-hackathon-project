import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { data, error } = await supabaseAdmin
    .from('designations')
    .select('*')
    .eq('company_id', g.profile.company_id)
    .order('name')
  if (error) return bad(error.message, 500)
  return json({ designations: data || [] })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.name?.trim()) return bad('Designation name is required')
  const { data, error } = await supabaseAdmin
    .from('designations')
    .insert({ company_id: g.profile.company_id, name: body.name.trim(), description: body.description || null })
    .select().single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'designation.create', 'designations', data.id, data, null, req)
  return json({ designation: data })
}
