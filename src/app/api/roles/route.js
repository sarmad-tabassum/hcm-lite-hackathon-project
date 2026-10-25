import { requireRole, needCompany, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/roles — list profiles of the company (admin)
export async function GET(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, employee_id')
    .eq('company_id', g.profile.company_id)
    .order('full_name')
  if (error) return json({ error: error.message }, 500)
  return json({ profiles: data || [] })
}
