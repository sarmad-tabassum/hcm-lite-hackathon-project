import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = 'sarmadtabassum7@gmail.com'
const PASSWORD = 'Sarmad@123'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// 1) Find the real company to re-attach ("Saylani Tech Ventures" survives; profiles were wiped)
const { data: companies } = await admin.from('companies').select('id, name').order('created_at')
const company = (companies || [])[0]
console.log('Company to attach:', company?.name || 'NONE')

// 2) Create or reset the owner's auth account (email_confirm → no email, no rate limit)
const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 })
const found = (existing.users || []).find((u) => u.email === EMAIL)
let userId
if (found) {
  const { error } = await admin.auth.admin.updateUserById(found.id, { password: PASSWORD, email_confirm: true })
  if (error) { console.log('UPDATE FAIL:', error.message); process.exit(1) }
  userId = found.id
  console.log('AUTH USER RESET:', EMAIL)
} else {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Sarmad Tabassum' },
  })
  if (error) { console.log('CREATE FAIL:', error.message); process.exit(1) }
  userId = created.user.id
  console.log('AUTH USER CREATED:', EMAIL)
}

// 3) Upsert the admin profile linked to the existing company → dashboard, not /setup
const { error: pErr } = await admin.from('profiles').upsert({
  id: userId,
  full_name: 'Sarmad Tabassum',
  email: EMAIL,
  role: 'admin',
  company_id: company?.id || null,
  employee_id: null,
})
if (pErr) { console.log('PROFILE FAIL:', pErr.message); process.exit(1) }
console.log('PROFILE UPSERTED: role=admin, company=' + (company?.name || 'null'))

// 4) Verify the exact path the login page uses
const anon = createClient(URL, ANON)
const { data, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (error) { console.log('SIGNIN FAIL:', error.message); process.exit(1) }
const { data: prof } = await admin.from('profiles').select('role, company_id, full_name').eq('id', data.user.id).single()
console.log('SIGNIN OK →', prof.full_name, '| role:', prof.role, '| company_id set:', !!prof.company_id)
console.log(prof.company_id ? '→ will land on /dashboard ✓' : '→ will land on /setup')
