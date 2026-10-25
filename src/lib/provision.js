import { supabaseAdmin } from './supabaseAdmin'
import crypto from 'crypto'

/**
 * Generate a readable temporary password, e.g. "Hcm-k7Pq2x9Z"
 */
export function tempPassword() {
  const raw = crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '')
  return `Hcm-${raw.slice(0, 8)}`
}

/**
 * Provision a REAL auth account for a company member (no email is sent —
 * admin.createAccount confirms instantly and returns a one-time password the
 * admin shares privately).
 *
 * Returns:
 *  - { ok: true, profile, tempPassword }  → account created & profile inserted
 *  - { ok: false, code: 'exists', companyId } → email already has a profile
 */
export async function provisionAccount({ email, fullName, phone, role = 'employee', companyId, employeeId }) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return { ok: false, code: 'no_email' }

  const { data: existing } = await supabaseAdmin
    .from('profiles').select('id, company_id').eq('email', cleanEmail).maybeSingle()
  if (existing) return { ok: false, code: 'exists', companyId: existing.company_id }

  const password = tempPassword()
  const { data: created, error: aErr } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true, // no confirmation email → no rate limits, works instantly
    user_metadata: { full_name: fullName || cleanEmail.split('@')[0] },
  })
  if (aErr) return { ok: false, code: 'auth_error', message: aErr.message }

  const baseRow = {
    id: created.user.id,
    company_id: companyId,
    role,
    full_name: fullName || cleanEmail.split('@')[0],
    email: cleanEmail,
    phone: phone || null,
  }

  // employee_id carries a UNIQUE constraint on profiles. If a retired/orphan
  // profile still owns this code, insert WITHOUT it instead of failing —
  // the code always lives on employees.employee_code anyway.
  let { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .insert({ ...baseRow, employee_id: employeeId || null })
    .select()
    .single()
  if (pErr && /profiles_employee_id_key|duplicate key/i.test(pErr.message || '')) {
    ;({ data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .insert(baseRow)
      .select()
      .single())
  }
  if (pErr) {
    // roll back the auth user so the email can be retried later
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    return { ok: false, code: 'profile_error', message: pErr.message }
  }
  return { ok: true, profile, tempPassword: password }
}
