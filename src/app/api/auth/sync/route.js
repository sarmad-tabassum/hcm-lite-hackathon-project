import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { json, bad } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { clientIp, throttle, readJson } from '@/lib/security'

/**
 * POST /api/auth/sync — creates the profile for a new auth user (idempotent).
 *
 * Multi-tenant rule:
 *  - If an HR-added employee record pre-registered this email → claim it and
 *    join that company as an employee.
 *  - Otherwise → this signup becomes the ADMIN of its own brand-new company
 *    workspace (runs /setup next). Every company's data stays fully isolated.
 */
export async function POST(req) {
  // sync is hit on every login and by pending accounts after signup — light
  // flood guard only (10/10min/IP is far above any real usage pattern).
  const flood = throttle(`sync:${clientIp(req)}`, 10, 10 * 60 * 1000)
  if (flood) return flood

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return bad('Not authenticated', 401)
  const { data: userData, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !userData?.user) return bad('Invalid session', 401)
  const user = userData.user
  const parsed = await readJson(req, 4 * 1024)
  if (parsed.error) return bad(parsed.error, parsed.status)
  const body = parsed.body || {}

  const { data: existing } = await supabaseAdmin
    .from('profiles').select('*').eq('id', user.id).maybeSingle()

  if (existing) {
    // Self-heal: profile exists but was never linked to a company, while an
    // employees row carries its code — adopt that row (provisioning was
    // interrupted, or the row was linked to the profile after the fact).
    // NOTE: employees has no email column on this schema — match by code.
    if (!existing.company_id && existing.employee_id) {
      const { data: emp } = await supabaseAdmin
        .from('employees').select('id, company_id, employee_code')
        .eq('employee_code', existing.employee_id).is('profile_id', null).maybeSingle()
      if (emp) {
        await supabaseAdmin.from('employees').update({ profile_id: user.id }).eq('id', emp.id)
        const { data: updated } = await supabaseAdmin
          .from('profiles')
          .update({ company_id: emp.company_id })
          .eq('id', user.id).select('*, companies(*)').single()
        return json({ profile: updated, linked: true })
      }
    }
    return json({ profile: existing, linked: false })
  }

  // New profile — self-service signup becomes the ADMIN of its own workspace.
  // (HR/employee seats come from /api/auth/register with a valid join code,
  // or are eagerly provisioned with real accounts by the admin/HR module.)
  const role = 'admin'
  const fullName = body.full_name || user.user_metadata?.full_name || user.email.split('@')[0]

  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      role,
      company_id: null,
    })
    .select('*, companies(*)')
    .single()
  if (pErr) return bad(pErr.message, 500)

  await logAudit(profile, 'auth.signup', 'profiles', user.id, { email: user.email, role })
  return json({ profile, linked: false, isFirstUser: true })
}
