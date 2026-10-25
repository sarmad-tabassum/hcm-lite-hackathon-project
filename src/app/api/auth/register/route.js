import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { json, bad } from '@/lib/authz'
import { logAudit } from '@/lib/audit'
import { verifyJoinCode } from '@/lib/joinCodes'
import { createClient } from '@supabase/supabase-js'
import {
  clientIp, throttle, sanitizeText, isValidEmail,
  normalizeJoinCode, passwordProblem, readJson,
} from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register — self-service account creation, SERVER-SIDE.
 *
 * Why server-side: client `supabase.auth.signUp()` triggers a confirmation
 * email, and the free tier's email quota produces "email rate limit exceeded"
 * right when a real user is onboarding. Here we create the auth user with
 * `email_confirm: true` — no email is ever sent, nothing to rate-limit.
 *
 * Modes (this is the role gate):
 *  - admin    → WITHOUT a code: ADMIN of a brand-new isolated workspace
 *               (runs /setup next). WITH a valid ADMIN join code: becomes an
 *               admin of THAT existing company — no /setup, lands straight on
 *               its dashboard. The code can only come from that company's admin.
 *  - hr       → requires the company's HR join code       → role 'hr'
 *  - employee → requires the company's Employee join code → role 'employee'
 *               (+ an employees row so attendance/leave/payroll work instantly)
 *
 * SECURITY MODEL:
 *  - The role is decided ONLY here, server-side, from the endpoint + valid
 *    code. A client can never self-assign a role.
 *  - HR/employee accounts start with user_metadata.approval='pending' — an
 *    ADMIN must approve them from the dashboard before they can touch any
 *    company data (enforced in requireRole on every API route).
 *  - Admin accounts are never pending: possession of the admin join code (or
 *    creating a fresh workspace) is the authorization.
 *  - Throttles: 20 req/10min/IP flood guard + 8 FAILED attempts/10min/IP
 *    (join-code brute-force / email enumeration protection).
 */

/** Find the company matching a presented join code for the given scope */
async function companyForCode(code, scope) {
  const { data: companies, error } = await supabaseAdmin.from('companies').select('id, name')
  if (error) return { error: 'Could not verify the join code — try again' }
  for (const c of companies || []) {
    if (verifyJoinCode(c.id, scope, code)) return { company: c }
  }
  return { error: 'Invalid join code. Ask your company admin for the correct code.' }
}

/** Next auto employee code, e.g. EMP-007 (custom codes untouched).
 *
 * Scans ALL companies, not just this one: profiles.employee_id carries a
 * GLOBAL unique constraint, so a per-company "EMP-001" would collide with
 * another company's EMP-001 and silently break the profile link. Global
 * numbering keeps both the employees row and the profile copy unique. */
async function nextEmployeeCode() {
  const { data } = await supabaseAdmin.from('employees').select('employee_code')
  let max = 0
  for (const row of data || []) {
    const m = /^EMP-(\d+)$/i.exec(row.employee_code || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `EMP-${String(max + 1).padStart(3, '0')}`
}

export async function POST(req) {
  const ip = clientIp(req)

  // Flood guard — every request counts (per IP)
  const flood = throttle(`reg:${ip}`, 20, 10 * 60 * 1000,
    'Too many signup attempts from this network — please wait a few minutes')
  if (flood) return flood

  const parsed = await readJson(req, 10 * 1024)
  if (parsed.error) return bad(parsed.error, parsed.status)
  const body = parsed.body || {}

  const mode = String(body.mode || '').toLowerCase()
  const fullName = sanitizeText(body.full_name, 80)
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254)
  const password = String(body.password || '').slice(0, 72)
  const joinCode = normalizeJoinCode(body.join_code)

  const fail = (message, status = 400) => {
    // Failures feed the brute-force throttle (invalid codes, bad passwords…)
    throttle(`regfail:${ip}`, 8, 10 * 60 * 1000,
      'Too many failed attempts — please wait a few minutes and try again')
    return bad(message, status)
  }

  if (!['admin', 'hr', 'employee'].includes(mode)) return bad('Unknown account type')
  if (fullName.length < 2) return fail('Please enter your full name')
  if (!isValidEmail(email)) return fail('Please enter a valid email address')
  const pwProblem = passwordProblem(password)
  if (pwProblem) return fail(pwProblem)

  // Already a member of some company? → send them to sign in, never absorb twice
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles').select('id, email, company_id').eq('email', email).maybeSingle()
  if (existingProfile) return fail('This email is already registered. Please sign in instead.', 409)

  // Resolve role + company per mode
  let role = null
  let companyId = null
  let employeeCode = null
  let joinedViaCode = false

  if (mode === 'admin') {
    if (joinCode) {
      // Joining an EXISTING company as its (co-)admin — the admin join code
      // is the authorization; without it a new isolated workspace is created.
      const { company, error: codeErr } = await companyForCode(joinCode, 'admin')
      if (codeErr) return fail(codeErr, 403)
      companyId = company.id
      joinedViaCode = true
    }
    // else: brand-new workspace — /setup creates the company next.
    role = 'admin'
  } else {
    if (!joinCode) return fail(`The ${mode === 'hr' ? 'HR' : 'Employee'} join code is required`)
    const { company, error: codeErr } = await companyForCode(joinCode, mode)
    if (codeErr) return fail(codeErr, 403)
    role = mode
    companyId = company.id
    if (mode === 'employee') employeeCode = await nextEmployeeCode()
  }

  // Create (or adopt) the auth user — confirmed instantly, no email sent
  const needsApproval = role !== 'admin'
  const metadata = {
    full_name: fullName,
    ...(needsApproval
      ? {
          approval: 'pending',
          requested_role: role,
          requested_at: new Date().toISOString(),
        }
      : {}),
  }

  let userId = null
  let createdHere = false
  const { data: created, error: aErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (aErr) {
    // Auth user already exists (e.g. created before its profile ever was).
    // Prove ownership by signing in with the given password, then adopt it.
    if (/already.*registered|already.*exists|duplicate/i.test(aErr.message || '')) {
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      const { data: proof, error: pErr2 } = await anon.auth.signInWithPassword({ email, password })
      if (pErr2 || !proof?.user) {
        return fail('This email is already registered. Please sign in instead.', 409)
      }
      userId = proof.user.id
      // Adopting a pre-existing auth user: make sure the approval flag is set
      // for staff roles even when the user object predates this feature.
      if (needsApproval) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: { ...(proof.user.user_metadata || {}), ...metadata },
        })
      }
    } else {
      console.error('[register] createUser failed:', aErr.message)
      return bad('Could not create the account right now — please try again', 500)
    }
  } else {
    userId = created.user.id
    createdHere = true
  }

  // Insert the profile — role is authoritative from the server
  const baseRow = { id: userId, full_name: fullName, email, role, company_id: companyId }

  let { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .insert({ ...baseRow, employee_id: employeeCode || null })
    .select('*, companies(*)')
    .single()

  if (pErr && /profiles_employee_id_key|duplicate key/i.test(pErr.message || '')) {
    // an orphan profile's old employee code owns the UNIQUE constraint —
    // insert without it; the code always lives on employees.employee_code
    ;({ data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .insert(baseRow)
      .select('*, companies(*)')
      .single())
  }

  if (pErr) {
    console.error('[register] profile insert failed:', pErr.message)
    if (createdHere) await supabaseAdmin.auth.admin.deleteUser(userId) // allow retry
    return bad('Account created but profile setup failed — please try signing up again in a minute', 500)
  }

  if (role === 'employee' && employeeCode) {
    // Code signup — create the directory row so attendance/leave/payroll work
    const { data: empRow, error: eErr } = await supabaseAdmin
      .from('employees')
      .insert({
        company_id: companyId,
        employee_code: employeeCode,
        joining_date: new Date().toISOString().slice(0, 10),
        basic_salary: 0,
        status: 'active',
        profile_id: userId,
      })
      .select('id')
      .single()
    if (!eErr && empRow) {
      // Mirror the code onto the profile for display; if a legacy profile from
      // another company still owns this code, skip quietly — employees.profile_id
      // remains the source-of-truth link for attendance/leave/payroll.
      const { error: upErr } = await supabaseAdmin
        .from('profiles').update({ employee_id: employeeCode }).eq('id', userId)
      if (upErr) console.warn('[register] profile employee_id mirror skipped:', upErr.message)
    }
  }

  await logAudit(profile, 'auth.register', 'profiles', userId, {
    email, mode, role, company_id: companyId, joined_via_code: joinedViaCode,
    approval: needsApproval ? 'pending' : 'auto_approved',
  }, null, req)

  return json({
    ok: true,
    role,
    company_id: companyId,
    needs_setup: role === 'admin' && !companyId,
    approval: needsApproval ? 'pending' : 'approved',
  })
}
