import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

export const json = (data, status = 200) => NextResponse.json(data, { status })
export const bad = (message, status = 400) => json({ error: message }, status)

/**
 * Server-side role guard — MUST be called on every API route.
 * Verifies the Supabase access token, loads the profile (role + company),
 * enforces the allowed roles list AND the admin-approval gate.
 *
 * Approval gate (professional security, enforced HERE so no client can skip it):
 *  - HR/employee accounts created through /api/auth/register start with
 *    user_metadata.approval = 'pending' and can only reach endpoints that
 *    pass { allowPending: true } (auth/me, auth/sync, admin/approvals).
 *  - Admins are never gated (a join code IS their authorization).
 *  - Legacy accounts without approval metadata are treated as approved.
 */
export async function requireRole(req, roles = null, opts = null) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    console.error('[authz] no token on', new URL(req.url).pathname)
    return { error: bad('Not authenticated', 401) }
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    console.error('[authz] invalid token on', new URL(req.url).pathname, userErr?.message)
    return { error: bad('Session invalid or expired', 401) }
  }
  const user = userData.user

  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .maybeSingle()
  if (pErr || !profile) {
    console.error('[authz] profile missing on', new URL(req.url).pathname, pErr?.message)
    return { error: bad('Profile not found. Please re-login.', 401) }
  }
  if (roles && !roles.includes(profile.role))
    return { error: bad('You do not have permission for this action', 403) }

  const pending = user.user_metadata?.approval === 'pending'
  if (pending && profile.role !== 'admin' && !(opts && opts.allowPending)) {
    return {
      error: json(
        { error: 'Your account is awaiting admin approval', code: 'ACCOUNT_PENDING' },
        403
      ),
    }
  }

  return { user, profile, approval: pending ? 'pending' : 'approved' }
}

/** Every company-scoped route starts with this */
export function needCompany(profile) {
  if (!profile.company_id) return bad('Your account is not linked to a company yet', 400)
  return null
}
