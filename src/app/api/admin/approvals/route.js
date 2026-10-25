import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireRole, needCompany, json, bad } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { throttle, clientIp, isUuid, readJson } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * Admin approval queue for self-registered HR / employee accounts.
 *
 * Registration puts staff into Supabase auth user_metadata:
 *   { approval: 'pending', requested_role, requested_at }
 * This endpoint is the ONLY way out of 'pending' — and it is admin-only,
 * scoped to the admin's own company (a pending account of another company
 * is invisible here, and profiles without a company can never appear).
 *
 * GET  → pending list for this company
 * POST → { user_id, action: 'approve' | 'reject' }
 *   approve: flips metadata to 'approved' (+ notification + audit)
 *   reject : removes the account entirely (auth user + profile + employee
 *            row) so the person can re-register with a correct code later.
 */

/** Scan auth users for pending accounts (paginated, hard-capped). */
async function pendingAuthUsers() {
  const found = []
  const perPage = 200
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) return { error }
    for (const u of data?.users || []) {
      if (u.user_metadata?.approval === 'pending') found.push(u)
    }
    const users = data?.users || []
    const lastPage = data?.lastPage ?? 1
    if (users.length < perPage || page >= lastPage) break
  }
  return { users: found }
}

export async function GET(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const companyId = g.profile.company_id

  const { users, error } = await pendingAuthUsers()
  if (error) {
    console.error('[approvals] listUsers failed:', error.message)
    return bad('Could not load the approval queue — please retry', 500)
  }
  if (users.length === 0) return json({ pending: [] })

  // Company isolation: only pending accounts whose profile is in THIS company
  const ids = users.map((u) => u.id)
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, company_id, employee_id')
    .in('id', ids)

  const byId = new Map((profiles || []).map((p) => [p.id, p]))
  const pending = users
    .map((u) => {
      const p = byId.get(u.id)
      if (!p || p.company_id !== companyId || p.role === 'admin') return null
      return {
        user_id: u.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        employee_code: p.employee_id || null,
        requested_at: u.user_metadata?.requested_at || u.created_at,
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.requested_at).localeCompare(String(b.requested_at)))

  return json({ pending })
}

export async function POST(req) {
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e

  const flood = throttle(`approve:${clientIp(req)}`, 60, 10 * 60 * 1000)
  if (flood) return flood

  const parsed = await readJson(req, 4 * 1024)
  if (parsed.error) return bad(parsed.error, parsed.status)
  const body = parsed.body || {}

  const userId = String(body.user_id || '')
  const action = String(body.action || '').toLowerCase()
  if (!isUuid(userId)) return bad('Invalid user id')
  if (!['approve', 'reject'].includes(action)) return bad('Unknown action')

  // Load the target — must be a pending staff member of THIS company
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, company_id')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return bad('That account no longer exists (maybe already handled)', 404)
  if (target.role === 'admin') return bad('Admin accounts are not part of the approval queue', 400)
  if (target.company_id !== g.profile.company_id)
    return bad('That account belongs to a different company', 403)

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (authUser?.user?.user_metadata?.approval !== 'pending')
    return bad('That account is not awaiting approval (maybe already handled)', 409)

  if (action === 'approve') {
    // Merge (never replace) user_metadata so full_name etc. survive
    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(authUser.user.user_metadata || {}),
        approval: 'approved',
        approved_by: g.user.id,
        approved_at: new Date().toISOString(),
      },
    })
    if (uErr) {
      console.error('[approvals] approve failed:', uErr.message)
      return bad('Could not approve the account — please retry', 500)
    }
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Account approved',
      message: `${g.profile.full_name || 'An admin'} approved your ${target.role} account for ${g.profile.companies?.name || 'the company'}. Sign in and you are all set.`,
      type: 'success',
    })
    await logAudit(g.profile, 'approval.approved', 'profiles', userId,
      { email: target.email, role: target.role }, null, req)
    return json({ ok: true, decision: 'approved' })
  }

  // ── reject: remove the account fully (clean re-registration path) ──
  // 1) directory rows created at signup (employees.profile_id)
  await supabaseAdmin.from('employees').delete().eq('profile_id', userId)
  // 2) their notifications
  await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
  // 3) the profile row
  const { error: dErr } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  // 4) the auth user
  const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (dErr || aErr) {
    console.error('[approvals] reject partial failure:', dErr?.message || '', aErr?.message || '')
    return bad('Could not fully remove the account — check the audit log', 500)
  }
  await logAudit(g.profile, 'approval.rejected', 'profiles', userId,
    { email: target.email, role: target.role, removed: true }, null, req)
  return json({ ok: true, decision: 'rejected' })
}
