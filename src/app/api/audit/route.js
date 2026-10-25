import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/audit?q= — admin only (M9)
export async function GET(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabaseAdmin
    .from('audit_logs')
    .select('id, action, table_name, record_id, old_data, new_data, ip_address, created_at, profiles(full_name)')
    .eq('company_id', g.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (q) query = query.ilike('action', `%${q}%`)

  const { data, error } = await query
  if (error) return bad(error.message, 500)
  return json({ logs: data || [] })
}
