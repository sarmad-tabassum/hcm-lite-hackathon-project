import { requireRole, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', g.user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return bad(error.message, 500)
  return json({ notifications: data || [] })
}

// PATCH — mark all as read
export async function PATCH(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const { error } = await supabaseAdmin
    .from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', g.user.id).eq('is_read', false)
  if (error) return bad(error.message, 500)
  return json({ ok: true })
}
