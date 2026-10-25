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

async function signUp(email, name) {
  const a = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await a.auth.admin.createUser({
    email, password: 'TestPass123!', email_confirm: true, user_metadata: { full_name: name },
  })
  if (error) throw new Error('createUser ' + email + ': ' + error.message)
  created.users.push(data.user.id)
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: s, error: sErr } = await anon.auth.signInWithPassword({ email, password: 'TestPass123!' })
  if (sErr) throw new Error('signIn ' + email + ': ' + sErr.message)
  return s.session.access_token
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
  // does PATCH.sql exist?
  const patchOk = await admin.from('employees').select('full_name').limit(1).then((r) => !r.error)
  console.log('PATCH.sql applied:', patchOk)

  console.log('\n[1] Admin A signup → own workspace')
  const tokA = await signUp('mt-admin-a@hcm.test', 'Admin A')
  let r = await api(tokA, '/api/auth/sync', 'POST', { full_name: 'Admin A' })
  check('A role = admin', r.j?.profile?.role === 'admin', JSON.stringify(r.j))
  check('A company = null (runs /setup)', r.j?.profile?.company_id === null)

  console.log('\n[2] Admin A creates company + dept + employee with real email (real account!)')
  r = await api(tokA, '/api/company', 'POST', { name: 'Alpha Corp' })
  check('company created', r.status === 200 && !!r.j?.company?.id, JSON.stringify(r.j))
  created.companies.push(r.j.company.id)
  const cidA = r.j.company.id
  r = await api(tokA, '/api/departments', 'POST', { name: 'Engineering' })
  check('dept created (A)', r.status === 200)
  const deptA = r.j?.department?.id

  r = await api(tokA, '/api/employees', 'POST', {
    employee_code: 'EMP-001', full_name: 'Employee One', email: 'mt-emp1@hcm.test',
    phone: '+92 300 1234567', basic_salary: 80000, department_id: deptA, role: 'employee',
  })
  check('employee created via API (no PATCH.sql needed)', r.status === 200, JSON.stringify(r.j))
  check('real account provisioned (one-time password returned)', !!r.j?.temp_password, JSON.stringify(r.j))
  check('employee linked to profile', !!r.j?.employee?.profile_id)
  check('name lives on profile (full_name returned)', r.j?.employee?.full_name === 'Employee One')
  const tempPw = r.j?.temp_password
  const empE1 = r.j?.employee

  console.log('\n[3] Employee E1 signs in with one-time password')
  if (tempPw) {
    const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await anon.auth.signInWithPassword({ email: 'mt-emp1@hcm.test', password: tempPw })
    check('E1 can sign in with temp password', !error, error?.message)
  }

  console.log('\n[4] Admin B signup → MUST get own workspace, NOT company A')
  const tokB = await signUp('mt-admin-b@hcm.test', 'Admin B')
  r = await api(tokB, '/api/auth/sync', 'POST', { full_name: 'Admin B' })
  check('B role = admin', r.j?.profile?.role === 'admin', JSON.stringify(r.j))
  check('B company = null (NOT pulled into Alpha Corp)', r.j?.profile?.company_id === null)
  r = await api(tokB, '/api/company', 'POST', { name: 'Beta Ltd' })
  check('B company created', r.status === 200, JSON.stringify(r.j))
  created.companies.push(r.j.company.id)

  console.log('\n[5] Data isolation between workspaces')
  r = await api(tokA, '/api/employees'); const listA = r.j?.employees || []
  r = await api(tokB, '/api/employees'); const listB = r.j?.employees || []
  check('A sees exactly own 1 employee with correct name', listA.length === 1 && listA[0]?.full_name === 'Employee One', JSON.stringify(listA))
  check('B sees zero employees (isolated)', listB.length === 0, `got ${listB.length}`)
  r = await api(tokA, '/api/departments'); const dA = r.j?.departments || []
  r = await api(tokB, '/api/departments'); const dB = r.j?.departments || []
  check('A sees 1 dept / B sees 0', dA.length === 1 && dB.length === 0)

  console.log('\n[6] Cross-tenant guard on Add employee')
  r = await api(tokB, '/api/employees', 'POST', {
    employee_code: 'HACK-01', full_name: 'Steal Admin A', email: 'mt-admin-a@hcm.test',
  })
  check('B cannot absorb A into own company', r.status === 400 && /already has an account/.test(r.j?.error || ''), JSON.stringify(r.j))

  console.log('\n[7] Claim path — pre-registered email joins as employee')
  if (patchOk) {
    const ins = { company_id: cidA, employee_code: 'EMP-CSV', email: 'mt-claim@hcm.test', full_name: 'Claim Test', joining_date: '2025-02-01', basic_salary: 50000, status: 'active' }
    const { data: seat, error: seatErr } = await admin.from('employees').insert(ins).select().single()
    if (!seatErr) {
      const tokC = await signUp('mt-claim@hcm.test', 'Claim Test')
      r = await api(tokC, '/api/auth/sync', 'POST', { full_name: 'Claim Test' })
      check('claimed seat → role employee', r.j?.profile?.role === 'employee', JSON.stringify(r.j))
      check('claimed seat → company = Alpha Corp', r.j?.profile?.company_id === cidA)
    } else {
      check('claim seat insert', false, seatErr.message)
    }
  } else {
    console.log('  (skipped — optional employees.email column not present; accounts are provisioned directly now)')
  }

  console.log(`\n======== RESULT: ${pass} passed, ${fail} failed ========`)
  await cleanup()
  const { data: remain } = await admin.auth.admin.listUsers()
  console.log('remaining auth users (should be only the real admin):', remain.users.map((u) => u.email))
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => { console.error('FATAL', e.message); await cleanup(); process.exit(1) })
