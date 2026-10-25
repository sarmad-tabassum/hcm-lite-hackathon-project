import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  return json({ company: g.profile.companies || null })
}

// First-run company creation (admin)
export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const { profile } = g
  if (profile.company_id) return bad('Company already exists')
  const body = await req.json()
  if (!body.name?.trim()) return bad('Company name is required')

  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .insert({
      name: body.name.trim(),
      office_start: body.office_start || '09:00',
      office_end: body.office_end || '17:00',
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      radius: body.radius || 100,
    })
    .select()
    .single()
  if (error) return bad(error.message, 500)

  await supabaseAdmin.from('profiles').update({ company_id: company.id }).eq('id', profile.id)
  await logAudit({ ...profile, company_id: company.id }, 'company.create', 'companies', company.id, company, null, req)
  return json({ company })
}

// Update company settings (admin)
export async function PATCH(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  const patch = {}
  if (body.name) patch.name = body.name.trim()
  if (body.office_start) patch.office_start = body.office_start
  if (body.office_end) patch.office_end = body.office_end
  if ('latitude' in body) patch.latitude = body.latitude
  if ('longitude' in body) patch.longitude = body.longitude
  if (body.radius) patch.radius = Number(body.radius)

  const { data: company, error } = await supabaseAdmin
    .from('companies').update(patch).eq('id', g.profile.company_id).select().single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'company.update', 'companies', company.id, patch, null, req)
  return json({ company })
}
