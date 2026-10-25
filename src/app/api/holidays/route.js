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
    .from('holidays').select('*').eq('company_id', g.profile.company_id).order('holiday_date')
  if (error) return bad(error.message, 500)
  return json({ holidays: data || [] })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.name?.trim() || !body.holiday_date) return bad('Holiday name and date are required')
  const { data: dup } = await supabaseAdmin
    .from('holidays').select('id').eq('company_id', g.profile.company_id).eq('holiday_date', body.holiday_date).maybeSingle()
  if (dup) return bad('A holiday already exists on this date')
  const { data, error } = await supabaseAdmin
    .from('holidays')
    .insert({ company_id: g.profile.company_id, name: body.name.trim(), holiday_date: body.holiday_date, description: body.description || null })
    .select().single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'holiday.create', 'holidays', data.id, data, null, req)
  return json({ holiday: data })
}
