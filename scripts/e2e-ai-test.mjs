import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// ⚠ DEAD-MAN'S GUARD — this script wipes the WHOLE database.
// It refuses to run unless you explicitly opt in with HCM_ALLOW_WIPE=1
if (process.env.HCM_ALLOW_WIPE !== '1') {
  console.error('REFUSING to wipe: this deletes ALL users and data. Re-run with HCM_ALLOW_WIPE=1 if you are absolutely sure.')
  process.exit(1)
}

const EMAIL_A = 'e2e-ai-admin@hcm.test'
const EMAIL_B = 'e2e-ai-emp@hcm.test'
const PASS = 'TestPass123!'

async function cleanup() {
  const tables = [
    'payslips', 'payroll_runs', 'attendance', 'leave_requests',
    'notifications', 'announcements', 'audit_logs', 'ai_logs',
    'employees', 'holidays', 'leave_types', 'designations', 'departments', 'companies', 'profiles',
  ]
  for (const t of tables) {
    await admin.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }
  const { data: users } = await admin.auth.admin.listUsers()
  for (const u of users.users) await admin.auth.admin.deleteUser(u.id)
}

async function signIn(email) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASS })
  if (error) throw new Error('signIn failed: ' + error.message)
  return data.session.access_token
}

async function main() {
  await cleanup()
  console.log('db wiped')

  // Admin user
  const { data: ua, error: ea } = await admin.auth.admin.createUser({
    email: EMAIL_A, password: PASS, email_confirm: true, user_metadata: { full_name: 'AI Test Admin' },
  })
  if (ea) throw ea
  // Employee user
  const { data: ub, error: eb } = await admin.auth.admin.createUser({
    email: EMAIL_B, password: PASS, email_confirm: true, user_metadata: { full_name: 'AI Test Emp' },
  })
  if (eb) throw eb

  // Company
  const { data: company, error: ec } = await admin.from('companies').insert({
    name: 'AI Test Ltd', office_start: '09:00:00', office_end: '17:00:00',
  }).select().single()
  if (ec) throw ec

  // Profiles
  const { error: epa } = await admin.from('profiles').insert({
    id: ua.user.id, company_id: company.id, role: 'admin', full_name: 'AI Test Admin',
    email: EMAIL_A, employee_id: 'ADM-001',
  })
  if (epa) throw epa
  const { error: epb } = await admin.from('profiles').insert({
    id: ub.user.id, company_id: company.id, role: 'employee', full_name: 'AI Test Emp',
    email: EMAIL_B, employee_id: 'EMP-001',
  })
  if (epb) throw epb
  const { data: profB } = await admin.from('profiles').select('id').eq('id', ub.user.id).single()

  // Employee row for B (PATCH.sql columns omitted — not needed for AI test)
  const { error: ee } = await admin.from('employees').insert({
    company_id: company.id, profile_id: profB.id, employee_code: 'EMP-001',
    joining_date: '2025-01-01', basic_salary: 100000, status: 'active',
  })
  if (ee) throw ee

  // Token for admin
  const token = await signIn(EMAIL_A)
  console.log('signed in as admin')

  // Call AI chat
  const res = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'How many employees do we have and what is my leave balance?' }] }),
  })
  const j = await res.json().catch(() => ({}))
  console.log('status:', res.status)
  console.log('reply:', JSON.stringify(j, null, 2))

  // cleanup
  await cleanup()
  console.log('cleanup done')
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
