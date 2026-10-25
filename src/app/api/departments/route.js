import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('company_id', g.profile.company_id)
    .order('name')
  if (error) return bad(error.message, 500)
  return json({ departments: data || [] })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.name?.trim()) return bad('Department name is required')
  const { data: dup } = await supabaseAdmin
    .from('departments').select('id').eq('company_id', g.profile.company_id).ilike('name', body.name.trim()).maybeSingle()
  if (dup) return bad('A department with this name already exists')
  const { data, error } = await supabaseAdmin
    .from('departments')
    .insert({ company_id: g.profile.company_id, name: body.name.trim(), description: body.description || null })
    .select().single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'department.create', 'departments', data.id, data, null, req)
  return json({ department: data })
}
