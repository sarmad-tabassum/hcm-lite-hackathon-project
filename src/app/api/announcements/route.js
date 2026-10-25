import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('id, title, content, published_at, profiles(full_name)')
    .eq('company_id', g.profile.company_id)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(20)
  if (error) return bad(error.message, 500)
  return json({ announcements: data || [] })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.title?.trim() || !body.content?.trim()) return bad('Title and content are required')
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      company_id: g.profile.company_id,
      title: body.title.trim(),
      content: body.content.trim(),
      created_by: g.user.id,
      published: true,
    })
    .select()
    .single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'announcement.create', 'announcements', data.id, { title: data.title }, null, req)
  return json({ announcement: data })
}
