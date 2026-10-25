/**
 * E2E — Task 11: separate role portals + fixed redirect flow
 *  [1] Fresh admin: signIn → sync → role=admin, company=null (lands /setup)
 *  [2] Admin completes setup (the EXACT call the setup form makes) → company created → dashboard works
 *  [3] Admin adds employee with real email → real account provisioned (one-time password)
 *  [4] Employee signIn → sync → role=employee + linked → portal APIs all 200
 *  [5] Employee self-service: check-in → status present; own payslips/leaves lists
 *  [6] Role gates: employee blocked from admin APIs (403)
 *  [7] Cross-tenant guard: second admin's employee never appears in first admin's data
 *  Cleanup: everything removed, real owner untouched.
 */
import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const REAL_ADMIN = 'sarmadtabassum7@gmail.com' // never touched

const created = { users: [], companies: [] }
let pass = 0, fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗ FAIL:', name, extra) }
}

async function api(token, path, method = 'GET', body) {
  const res = await fetch('http://localhost:3000' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  let j = null
  try { j = await res.json() } catch {}
  return { status: res.status, j }
}

async function signInAndGetToken(email, password) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error) throw new Error('signIn ' + email + ': ' + error.message)
  return data.session.access_token
}

async function cleanup() {
  for (const cid of created.companies) {
    for (const t of ['payslips', 'payroll_runs', 'attendance', 'leave_requests', 'notifications', 'announcements', 'audit_logs', 'ai_logs', 'employees', 'holidays', 'leave_types', 'designations', 'departments']) {
      await admin.from(t).delete().eq('company_id', cid)
    }
    await admin.from('companies').delete().eq('id', cid)
  }
  for (const uid of created.users) {
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
  }
}

async function main() {
  const stamp = Date.now()
  const adminEmail = `rp-admin-${stamp}@hcm.test`
  const empEmail = `rp-emp-${stamp}@hcm.test`
  const otherAdminEmail = `rp-other-${stamp}@hcm.test`
  const empCode = `EMP-${String(stamp).slice(-4)}`
  const PW = 'TestPass123!'

  try {
    console.log('\n[1] Fresh admin signs in → sync says: run /setup')
    const a = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: au, error: auErr } = await a.auth.admin.createUser({
      email: adminEmail, password: PW, email_confirm: true, user_metadata: { full_name: 'Portal Admin' },
    })
    if (auErr) throw new Error('createUser admin: ' + auErr.message)
    created.users.push(au.user.id)

    let tok = await signInAndGetToken(adminEmail, PW)
    let r = await api(tok, '/api/auth/sync', 'POST', {})
    check('sync 200', r.status === 200, JSON.stringify(r.j))
    check('role = admin', r.j?.profile?.role === 'admin')
    check('company null → client routes to /setup', r.j?.profile?.company_id === null)

    console.log('\n[2] Admin completes setup — EXACT call the setup form makes')
    r = await api(tok, '/api/company', 'POST', {
      name: 'ABCDE Test Co',
      office_start: '09:00',
      office_end: '17:00',
      latitude: 24.862926,
      longitude: 67.086268,
      radius: 100,
    })
    check('company created (setup no longer "Not authenticated")', r.status === 200 && !!r.j?.company?.id, JSON.stringify(r.j))
    const cidA = r.j.company.id
    created.companies.push(cidA)

    r = await api(tok, '/api/auth/me')
    check('me → company linked (lands /dashboard)', r.status === 200 && r.j?.profile?.company_id === cidA)
    r = await api(tok, '/api/dashboard')
    check('admin dashboard payload 200 (headcount 0)', r.status === 200 && r.j?.role === 'admin', JSON.stringify(r.j).slice(0, 120))

    console.log('\n[3] Admin adds employee with real email → real account + one-time password')
    r = await api(tok, '/api/departments', 'POST', { name: 'Operations' })
    const deptA = r.j?.department?.id
    r = await api(tok, '/api/employees', 'POST', {
      employee_code: empCode, full_name: 'Rabia Student', email: empEmail,
      phone: '+92 300 1112223', basic_salary: 60000, department_id: deptA, role: 'employee',
    })
    check('employee created', r.status === 200, JSON.stringify(r.j))
    check('real account provisioned (temp password returned)', !!r.j?.temp_password)
    check('employee linked to profile (company_id set)', !!r.j?.employee?.profile_id)
    // track the provisioned account so cleanup removes it too
    const { data: provProfile } = await admin.from('profiles').select('id').eq('email', empEmail).maybeSingle()
    if (provProfile) created.users.push(provProfile.id)

    console.log('\n[4] Employee signs in → sync links seat → role=employee')
    const empTok = await signInAndGetToken(empEmail, r.j.temp_password)
    r = await api(empTok, '/api/auth/sync', 'POST', {})
    check('sync 200', r.status === 200)
    check('role = employee', r.j?.profile?.role === 'employee')
    check('company set → client routes to /portal', r.j?.profile?.company_id === cidA)

    console.log('\n[5] Employee self-service portal APIs (My Space)')
    r = await api(empTok, '/api/dashboard')
    check('employee dashboard shape (today/balances/announcements)', r.status === 200 && r.j?.role === 'employee' && Array.isArray(r.j?.balances), JSON.stringify(r.j).slice(0, 150))
    r = await api(empTok, '/api/attendance/today')
    check('attendance/today 200 (no record yet)', r.status === 200 && r.j?.employee?.employee_code === empCode && r.j?.row === null, JSON.stringify(r.j))

    // geo check-in inside the 100m fence (offset ~0.0002 deg ≈ 22m)
    r = await api(empTok, '/api/attendance/check-in', 'POST', { latitude: 24.8631, longitude: 67.0863 })
    check('check-in inside geofence works', r.status === 200 && !!r.j?.row?.check_in, JSON.stringify(r.j))
    r = await api(empTok, '/api/attendance/check-in', 'POST', { latitude: 24.8631, longitude: 67.0863 })
    check('double check-in rejected', r.status === 400, JSON.stringify(r.j))
    r = await api(empTok, '/api/attendance/check-out', 'POST', {})
    check('check-out works + returns worked_hours', r.status === 200 && typeof r.j?.worked_hours === 'number', JSON.stringify(r.j))
    r = await api(tok, '/api/attendance/register')
    check('team register 200 (worked_hours bug fixed)', r.status === 200 && Array.isArray(r.j?.rows) && r.j.rows.length === 1 && !!r.j.rows[0].att, JSON.stringify(r.j).slice(0, 200))
    r = await api(empTok, '/api/payroll?mine=1')
    check('my payslips 200 (empty list)', r.status === 200 && Array.isArray(r.j?.slips) && r.j.slips.length === 0)
    r = await api(empTok, '/api/leave')
    check('my leave requests 200 (empty list)', r.status === 200 && Array.isArray(r.j?.requests) && r.j.requests.length === 0)

    console.log('\n[6] Role gates — employee cannot touch admin APIs')
    r = await api(empTok, '/api/employees')
    check('GET /api/employees → 403', r.status === 403)
    r = await api(empTok, '/api/audit')
    check('GET /api/audit → 403', r.status === 403)
    r = await api(empTok, '/api/payroll/run', 'POST', { month: 1, year: 2026 })
    check('POST /api/payroll/run → 403', r.status === 403)

    console.log('\n[7] Second admin → own isolated workspace (no cross-company leaks)')
    const { data: ou } = await a.auth.admin.createUser({
      email: otherAdminEmail, password: PW, email_confirm: true, user_metadata: { full_name: 'Other Admin' },
    })
    created.users.push(ou.user.id)
    const tokB = await signInAndGetToken(otherAdminEmail, PW)
    r = await api(tokB, '/api/auth/sync', 'POST', {})
    check('B role = admin, own workspace', r.j?.profile?.role === 'admin' && r.j?.profile?.company_id === null)
    r = await api(tokB, '/api/company', 'POST', { name: 'Other Corp' })
    check('B company created', r.status === 200 && !!r.j?.company?.id)
    created.companies.push(r.j.company.id)
    r = await api(tokB, '/api/employees')
    check('B sees ZERO employees from ABCDE Test Co', r.status === 200 && (r.j?.employees || []).length === 0)
    r = await api(tokB, '/api/attendance/register')
    check('B register has no ABCDE rows', r.status === 200 && (r.j?.rows || []).length === 0, JSON.stringify(r.j).slice(0, 200))

  } finally {
    console.log('\n— cleanup —')
    await cleanup()
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    console.log('profiles left:', count, '(owner only = 1)')
  }

  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error('E2E crashed:', e.message)
  await cleanup()
  process.exit(1)
})
