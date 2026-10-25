/**
 * E2E — role portals + self-service signup (Task 11-c)
 * Covers: server-side register (admin/HR/employee), join-code enforcement,
 * portal role separation, dashboard landing, and cleanup of test accounts.
 */
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0, fail = 0
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}
const stamp = Date.now().toString(36)
const HR_EMAIL = `qa-hr-${stamp}@test-hcm.dev`
const EMP_EMAIL = `qa-emp-${stamp}@test-hcm.dev`
const PW = 'QaPass@123'

async function register(body) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

async function pageStatus(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
    return res.status
  } catch { return 0 }
}

console.log('— 1. Pages render —')
for (const p of ['/login', '/login/admin', '/login/hr', '/login/employee', '/signup', '/signup/hr', '/signup/employee']) {
  const s = await pageStatus(p)
  check(`GET ${p} → 200`, s === 200, `got ${s}`)
}

console.log('— 2. Admin join codes (owner account) —')
const { data: own } = await anon.auth.signInWithPassword({ email: 'sarmadtabassum7@gmail.com', password: 'Sarmad@123' })
check('owner sign-in works', !!own?.session)
const codesRes = await fetch(`${BASE}/api/auth/join-codes`, { headers: { Authorization: `Bearer ${own.session.access_token}` } })
const codes = await codesRes.json()
check('GET /api/auth/join-codes → 200', codesRes.status === 200, `got ${codesRes.status}`)
check('ADMIN code format HCM-ADM-XXXX-XXXX', /^HCM-ADM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codes.admin_code || ''), codes.admin_code)
check('HR code format HCM-HR-XXXX-XXXX', /^HCM-HR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codes.hr_code || ''), codes.hr_code)
check('Employee code format HCM-EMP-XXXX-XXXX', /^HCM-EMP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codes.employee_code || ''), codes.employee_code)

console.log('— 3. Join-code enforcement —')
const noCode = await register({ mode: 'hr', full_name: 'QA HR', email: HR_EMAIL, password: PW })
check('HR signup without code → 400', noCode.status === 400, `got ${noCode.status}`)
const badCode = await register({ mode: 'hr', full_name: 'QA HR', email: HR_EMAIL, password: PW, join_code: 'HCM-HR-AAAA-BBBB' })
check('HR signup with wrong code → 403', badCode.status === 403, `got ${badCode.status}`)
const badEmp = await register({ mode: 'employee', full_name: 'QA Emp', email: EMP_EMAIL, password: PW, join_code: codes.hr_code })
check('HR code rejected on employee portal → 403', badEmp.status === 403, `got ${badEmp.status}`)

console.log('— 4. Self-service signup (server-side, no email limit) —')
const hr = await register({ mode: 'hr', full_name: 'QA HR Person', email: HR_EMAIL, password: PW, join_code: codes.hr_code })
check('HR signup with valid code → ok', hr.status === 200 && hr.data.role === 'hr', JSON.stringify(hr.data))
check('HR linked to owner company', hr.data.company_id === codes.company.id)
check('HR starts PENDING admin approval', hr.data.approval === 'pending', JSON.stringify(hr.data))
const emp = await register({ mode: 'employee', full_name: 'QA Emp Person', email: EMP_EMAIL, password: PW, join_code: codes.employee_code })
check('Employee signup with valid code → ok', emp.status === 200 && emp.data.role === 'employee', JSON.stringify(emp.data))
check('Employee starts PENDING admin approval', emp.data.approval === 'pending')
const dup = await register({ mode: 'hr', full_name: 'QA HR', email: HR_EMAIL, password: PW, join_code: codes.hr_code })
check('duplicate email → 409', dup.status === 409, `got ${dup.status}`)

// employees row must exist for the code-registered employee (match by profile — no email column)
const { data: empProf } = await admin.from('profiles').select('id, employee_id, role').eq('email', EMP_EMAIL).maybeSingle()
check('profile.employee_id assigned (EMP-xxx)', /^EMP-\d+$/.test(empProf?.employee_id || ''), empProf?.employee_id)
const { data: empRow } = empProf?.id
  ? await admin.from('employees').select('employee_code, profile_id, company_id').eq('profile_id', empProf.id).maybeSingle()
  : { data: null }
check('employee directory row auto-created', !!empRow && !!empRow.profile_id)
check('directory row code matches profile.employee_id', !!empRow && empRow.employee_code === empProf.employee_id)

console.log('— 5. Portal role separation (the hard gate) —')
async function portalLogin(email, password, portalRole) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) return { error: error?.message }
  const res = await fetch(`${BASE}/api/auth/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: '{}',
  })
  const j = await res.json().catch(() => ({}))
  return { token: data.session.access_token, role: j.profile?.role, companyId: j.profile?.company_id }
}

const hrLogin = await portalLogin(HR_EMAIL, PW)
check('HR sign-in → role hr', hrLogin.role === 'hr', JSON.stringify(hrLogin))
check('HR sign-in → company linked', !!hrLogin.companyId)
const empLogin = await portalLogin(EMP_EMAIL, PW)
check('Employee sign-in → role employee', empLogin.role === 'employee')

// Approval gate — pending staff are locked out of ALL data APIs (server-enforced)
const hrMePending = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${hrLogin.token}` } })
const hrMePendingData = await hrMePending.json().catch(() => ({}))
check('me says approval_status=pending (client routes to /approval)', hrMePendingData.approval_status === 'pending', JSON.stringify(hrMePendingData).slice(0, 100))
const hrBlocked = await fetch(`${BASE}/api/employees`, { headers: { Authorization: `Bearer ${hrLogin.token}` } })
const hrBlockedData = await hrBlocked.json().catch(() => ({}))
check('pending HR blocked from /api/employees → 403 ACCOUNT_PENDING', hrBlocked.status === 403 && hrBlockedData.code === 'ACCOUNT_PENDING', `got ${hrBlocked.status}`)

// Owner approves both accounts from the queue → APIs unlock
const qRes = await fetch(`${BASE}/api/admin/approvals`, { headers: { Authorization: `Bearer ${own.session.access_token}` } })
const qData = await qRes.json().catch(() => ({}))
const qHr = (qData.pending || []).find((p) => p.email === HR_EMAIL)
const qEmp = (qData.pending || []).find((p) => p.email === EMP_EMAIL)
check('owner queue shows both pending accounts', !!qHr && !!qEmp, JSON.stringify(qData).slice(0, 200))
const ap1 = await fetch(`${BASE}/api/admin/approvals`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${own.session.access_token}` },
  body: JSON.stringify({ user_id: qHr?.user_id, action: 'approve' }),
})
const ap2 = await fetch(`${BASE}/api/admin/approvals`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${own.session.access_token}` },
  body: JSON.stringify({ user_id: qEmp?.user_id, action: 'approve' }),
})
check('owner approves HR + employee', ap1.status === 200 && ap2.status === 200, `${ap1.status}/${ap2.status}`)

// HR credentials on the EMPLOYEE portal must be rejected by the UI rule (role !== portal)
check('HR id ≠ employee role → would be bounced from /login/employee', hrLogin.role !== 'employee')
check('Employee id ≠ hr role → would be bounced from /login/hr', empLogin.role !== 'hr')

// Server-side role gates still hold (now that approvals are done)
const hrEmployees = await fetch(`${BASE}/api/employees`, { headers: { Authorization: `Bearer ${hrLogin.token}` } })
check('HR can read /api/employees after approval → 200', hrEmployees.status === 200, `got ${hrEmployees.status}`)
const empEmployees = await fetch(`${BASE}/api/employees`, { headers: { Authorization: `Bearer ${empLogin.token}` } })
check('Employee blocked from /api/employees → 403 (role gate)', empEmployees.status === 403, `got ${empEmployees.status}`)
const empCodes = await fetch(`${BASE}/api/auth/join-codes`, { headers: { Authorization: `Bearer ${empLogin.token}` } })
check('Employee blocked from join-codes → 403', empCodes.status === 403, `got ${empCodes.status}`)

console.log('— 6. Owner lands on dashboard-ready state —')
const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${own.session.access_token}` } })
const me = await meRes.json()
check('owner profile has company → /dashboard (no loop, no setup)', meRes.status === 200 && !!me.profile?.company_id)

console.log('— 7. Cleanup test accounts —')
async function wipe(email) {
  const { data: p } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (p) {
    await admin.from('employees').delete().eq('profile_id', p.id)
    await admin.from('profiles').delete().eq('id', p.id)
  }
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 500 })
  const u = (users.users || []).find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
  console.log(`  cleaned ${email}`)
}
await wipe(HR_EMAIL)
await wipe(EMP_EMAIL)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
