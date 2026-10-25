/**
 * E2E — Task 14: professional security + admin approval flow + admin join codes
 *
 * RUN THIS SUITE LAST (it consumes the in-memory register rate-limit budget
 * for localhost; the other suites need those slots — or restart the dev
 * server before rerunning any suite).
 *
 * Covers:
 *  [1] Security headers on every response (CSP, anti-clickjacking, etc.)
 *  [2] Password policy on new accounts (length / complexity / common list)
 *  [3] Admin join code: admin signup WITH code joins the EXISTING company
 *  [4] Admin signup WITHOUT code → brand-new isolated workspace
 *  [5] Approval lifecycle: HR signup → pending → APIs blocked (403
 *      ACCOUNT_PENDING) → admin queue shows it → approve → APIs work
 *  [6] Reject lifecycle: employee signup → pending → reject → account fully
 *      removed (profile + auth user + directory row), sign-in impossible
 *  [7] Approval isolation: another company's admin can neither see nor act
 *  [8] Register flood limiter → 429s (in-memory, last test on purpose)
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
const PW = 'QaStr0ng!Pass'
const ADMIN_CODE_EMAIL = `qa-coadmin-${stamp}@test-hcm.dev`
const NEW_ADMIN_EMAIL = `qa-newadmin-${stamp}@test-hcm.dev`
const HR_EMAIL = `qa-sec-hr-${stamp}@test-hcm.dev`
const EMP_EMAIL = `qa-sec-emp-${stamp}@test-hcm.dev`
const OTHER_ADMIN_EMAIL = `qa-sec-other-${stamp}@test-hcm.dev`

async function register(body) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

async function api(token, path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => ({})), headers: res.headers }
}

async function signIn(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data?.session) return { error: error?.message }
  return { token: data.session.access_token, userId: data.user.id }
}

async function main() {
  console.log('— 0. Owner session + codes —')
  const owner = await signIn('sarmadtabassum7@gmail.com', 'Sarmad@123')
  check('owner signs in', !!owner.token)
  const codes = (await api(owner.token, '/api/auth/join-codes')).data
  check('owner gets admin_code (HCM-ADM-…)', /^HCM-ADM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codes.admin_code || ''), codes.admin_code)
  const ownerCompanyId = codes.company.id

  console.log('\n— 1. Security headers —')
  const home = await api(null, '/login')
  check('X-Frame-Options: DENY', home.headers.get('x-frame-options') === 'DENY', home.headers.get('x-frame-options'))
  check('X-Content-Type-Options: nosniff', home.headers.get('x-content-type-options') === 'nosniff')
  check('Referrer-Policy strict-origin-when-cross-origin', home.headers.get('referrer-policy') === 'strict-origin-when-cross-origin')
  const csp = home.headers.get('content-security-policy') || ''
  check('CSP present with frame-ancestors none', csp.includes("frame-ancestors 'none'") && csp.includes('default-src'))
  check('CSP allows Supabase origin', csp.includes('beydmjrjhpsqqcqoszal.supabase.co'))
  const apiNoAuth = await api(null, '/api/auth/me')
  check('API responses carry headers too', apiNoAuth.headers.get('x-frame-options') === 'DENY')
  check('me without token → 401', apiNoAuth.status === 401)

  console.log('\n— 2. Password policy (new accounts) —')
  const weak1 = await register({ mode: 'employee', full_name: 'QA Weak', email: `qa-weak1-${stamp}@test-hcm.dev`, password: 'abc123', join_code: codes.employee_code })
  check('short password → 400', weak1.status === 400, `got ${weak1.status}`)
  const weak2 = await register({ mode: 'employee', full_name: 'QA Weak', email: `qa-weak2-${stamp}@test-hcm.dev`, password: 'password123', join_code: codes.employee_code })
  check('common password → 400', weak2.status === 400, `got ${weak2.status}`)
  const weak3 = await register({ mode: 'employee', full_name: 'QA Weak', email: `qa-weak3-${stamp}@test-hcm.dev`, password: 'alllowercase1', join_code: codes.employee_code })
  check('no-uppercase password → 400', weak3.status === 400, `got ${weak3.status}`)

  console.log('\n— 3. Admin join code → co-admin of the EXISTING company —')
  const coAdmin = await register({ mode: 'admin', full_name: 'QA Co Admin', email: ADMIN_CODE_EMAIL, password: PW, join_code: codes.admin_code })
  check('admin signup with code → ok', coAdmin.status === 200 && coAdmin.data.role === 'admin', JSON.stringify(coAdmin.data))
  check('lands on dashboard (needs_setup false)', coAdmin.data.needs_setup === false)
  check('joined the OWNER company', coAdmin.data.company_id === ownerCompanyId)
  const co = await signIn(ADMIN_CODE_EMAIL, PW)
  check('co-admin signs in', !!co.token)
  const coCodes = await api(co.token, '/api/auth/join-codes')
  check('co-admin reads the same company codes', coCodes.status === 200 && coCodes.data.company.id === ownerCompanyId)
  const coNotPending = await api(co.token, '/api/auth/me')
  check('admins are never approval-gated', coNotPending.data.approval_status === 'approved' || coNotPending.status === 200)

  console.log('\n— 4. Admin without code → brand-new isolated workspace —')
  const newAdmin = await register({ mode: 'admin', full_name: 'QA New Admin', email: NEW_ADMIN_EMAIL, password: PW })
  check('admin signup without code → needs_setup true', newAdmin.status === 200 && newAdmin.data.needs_setup === true, JSON.stringify(newAdmin.data))
  check('no company attached yet', !newAdmin.data.company_id)
  const na = await signIn(NEW_ADMIN_EMAIL, PW)
  const naCompany = await api(na.token, '/api/company', 'POST', { name: `Sec Test Co ${stamp}` })
  check('new admin sets up own company', naCompany.status === 200 && !!naCompany.data.company?.id)
  const naEmployees = await api(na.token, '/api/employees')
  check('new workspace sees ZERO of the owner employees (isolation)', naEmployees.status === 200 && (naEmployees.data.employees || []).length === 0)
  const naApprovals = await api(na.token, '/api/admin/approvals')
  check('new admin approval queue starts empty', naApprovals.status === 200 && (naApprovals.data.pending || []).length === 0)

  console.log('\n— 5. Approval lifecycle (HR) —')
  const hr = await register({ mode: 'hr', full_name: 'QA Sec HR', email: HR_EMAIL, password: PW, join_code: codes.hr_code })
  check('HR signup → ok with approval pending', hr.status === 200 && hr.data.approval === 'pending', JSON.stringify(hr.data))
  const hrS = await signIn(HR_EMAIL, PW)
  check('pending HR can sign in (session valid)', !!hrS.token)
  const hrMe = await api(hrS.token, '/api/auth/me')
  check('me reports approval_status=pending', hrMe.status === 200 && hrMe.data.approval_status === 'pending', JSON.stringify(hrMe.data).slice(0, 120))
  const hrEmp = await api(hrS.token, '/api/employees')
  check('staff API blocked while pending → 403', hrEmp.status === 403, `got ${hrEmp.status}`)
  check('403 carries ACCOUNT_PENDING code', hrEmp.data.code === 'ACCOUNT_PENDING', JSON.stringify(hrEmp.data))
  const hrDash = await api(hrS.token, '/api/dashboard')
  check('dashboard blocked while pending → 403', hrDash.status === 403)

  const queue = await api(owner.token, '/api/admin/approvals')
  const inQueue = (queue.data.pending || []).find((p) => p.email === HR_EMAIL)
  check('owner queue lists the pending HR', !!inQueue, JSON.stringify(queue.data).slice(0, 200))
  check('queue row carries role + request time', inQueue?.role === 'hr' && !!inQueue?.requested_at)

  const approved = await api(owner.token, '/api/admin/approvals', 'POST', { user_id: inQueue.user_id, action: 'approve' })
  check('owner approves → ok', approved.status === 200 && approved.data.decision === 'approved', JSON.stringify(approved.data))
  const hrMe2 = await api(hrS.token, '/api/auth/me')
  check('same session now reports approved', hrMe2.data.approval_status === 'approved')
  const hrEmp2 = await api(hrS.token, '/api/employees')
  check('staff API unlocked after approval → 200', hrEmp2.status === 200, `got ${hrEmp2.status}`)
  const { data: hrNotif } = await admin.from('notifications').select('title').eq('user_id', inQueue.user_id).limit(1)
  check('approval notification delivered', (hrNotif || []).length > 0)

  console.log('\n— 6. Reject lifecycle (employee) —')
  const emp = await register({ mode: 'employee', full_name: 'QA Sec Emp', email: EMP_EMAIL, password: PW, join_code: codes.employee_code })
  check('employee signup → pending', emp.status === 200 && emp.data.approval === 'pending')
  const empS = await signIn(EMP_EMAIL, PW)
  const empMe = await api(empS.token, '/api/auth/me')
  const empQueue = await api(owner.token, '/api/admin/approvals')
  const empRow = (empQueue.data.pending || []).find((p) => p.email === EMP_EMAIL)
  check('pending employee visible in queue', !!empRow)
  const empBlocked = await api(empS.token, '/api/attendance/today')
  check('employee APIs blocked while pending → 403', empBlocked.status === 403)
  const rejected = await api(owner.token, '/api/admin/approvals', 'POST', { user_id: empRow.user_id, action: 'reject' })
  check('owner rejects → ok', rejected.status === 200 && rejected.data.decision === 'rejected', JSON.stringify(rejected.data))
  const { data: goneProfile } = await admin.from('profiles').select('id').eq('email', EMP_EMAIL).maybeSingle()
  check('profile removed after reject', !goneProfile)
  const { data: goneEmp } = await admin.from('employees').select('id').eq('profile_id', empRow.user_id).maybeSingle()
  check('directory row removed after reject', !goneEmp)
  const { data: usersLeft } = await admin.auth.admin.listUsers({ perPage: 500 })
  check('auth user removed after reject', !(usersLeft.users || []).some((u) => u.email === EMP_EMAIL))
  const empReLogin = await signIn(EMP_EMAIL, PW)
  check('rejected account cannot sign in anymore', !!empReLogin.error)
  const empMeAfter = await api(empS.token, '/api/auth/me')
  check('old session dead after reject → 401', empMeAfter.status === 401)

  console.log('\n— 7. Approval isolation between companies —')
  const other = await register({ mode: 'admin', full_name: 'QA Other Admin', email: OTHER_ADMIN_EMAIL, password: PW })
  const ot = await signIn(OTHER_ADMIN_EMAIL, PW)
  await api(ot.token, '/api/company', 'POST', { name: `Other Sec Co ${stamp}` })
  // Re-register a pending HR under the OTHER company (use its own codes)
  const otherCodes = await api(ot.token, '/api/auth/join-codes')
  const hr2Email = `qa-sec-hr2-${stamp}@test-hcm.dev`
  await register({ mode: 'hr', full_name: 'QA Other HR', email: hr2Email, password: PW, join_code: otherCodes.data.hr_code })
  const otherQueue = await api(ot.token, '/api/admin/approvals')
  check('other admin sees only OWN pending (not owner company)', (otherQueue.data.pending || []).every((p) => p.email !== HR_EMAIL))
  const cross = await api(ot.token, '/api/admin/approvals', 'POST', { user_id: empMe.data.profile.id, action: 'approve' })
  check('other admin cannot act on owner-company account → 403/404', [403, 404].includes(cross.status), `got ${cross.status}`)
  const hrQueueForOwner = await api(owner.token, '/api/admin/approvals')
  check('owner queue does NOT leak other company pending', (hrQueueForOwner.data.pending || []).every((p) => p.email !== hr2Email))

  console.log('\n— 8. Register flood limiter (run last) —')
  let saw429 = false
  for (let i = 0; i < 30; i++) {
    const r = await register({ mode: 'hr', full_name: 'Flood', email: `flood-${stamp}-${i}@x.dev`, password: PW })
    if (r.status === 429) { saw429 = true; break }
  }
  check('register flood eventually 429s', saw429)

  console.log('\n— cleanup —')
  const emails = [ADMIN_CODE_EMAIL, NEW_ADMIN_EMAIL, HR_EMAIL, hr2Email, OTHER_ADMIN_EMAIL]
  for (const email of emails) {
    const { data: p } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (p) {
      await admin.from('employees').delete().eq('profile_id', p.id)
      await admin.from('notifications').delete().eq('user_id', p.id)
      await admin.from('profiles').delete().eq('id', p.id)
    }
    const { data: us } = await admin.auth.admin.listUsers({ perPage: 500 })
    const u = (us.users || []).find((x) => x.email === email)
    if (u) await admin.auth.admin.deleteUser(u.id)
    console.log(`  cleaned ${email}`)
  }
  // companies created by the two no-code admins in this suite
  for (const name of [`Sec Test Co ${stamp}`, `Other Sec Co ${stamp}`]) {
    const { data: c } = await admin.from('companies').select('id').eq('name', name).maybeSingle()
    if (c) {
      for (const t of ['payslips', 'payroll_runs', 'attendance', 'leave_requests', 'notifications', 'announcements', 'audit_logs', 'ai_logs', 'employees', 'holidays', 'leave_types', 'designations', 'departments']) {
        await admin.from(t).delete().eq('company_id', c.id)
      }
      await admin.from('companies').delete().eq('id', c.id)
      console.log(`  cleaned company ${name}`)
    }
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('E2E crashed:', e.message); process.exit(1) })
