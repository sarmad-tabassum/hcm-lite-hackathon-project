import { requireRole, json, bad } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

export async function GET(req) {
  // allowPending: the approval waiting-room polls this endpoint to detect
  // the moment an admin approves (or while pending) — must not be gated.
  const g = await requireRole(req, null, { allowPending: true })
  if (g.error) return g.error
  return json({
    profile: g.profile,
    company: g.profile.companies || null,
    approval_status: g.approval,
  })
}

// PUT /api/auth/me — self-service profile update (own name & phone only)
export async function PUT(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  let body = {}
  try { body = await req.json() } catch {}
  const patch = {}
  if (typeof body.full_name === 'string' && body.full_name.trim()) patch.full_name = body.full_name.trim().slice(0, 120)
  if (typeof body.phone === 'string') patch.phone = body.phone.trim().slice(0, 40)
  if (!Object.keys(patch).length) return bad('Nothing to update', 400)
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', g.user.id)
    .select('*, companies(*)')
    .single()
  if (error) return bad(error.message, 500)
  await logAudit(g.profile, 'auth.profile_update', 'profiles', g.user.id, patch)
  return json({ profile: data })
}
