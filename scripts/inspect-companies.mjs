import { createClient } from '@supabase/supabase-js'
const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// Full column list for companies (OpenAPI introspection via PostgREST)
const res = await fetch(`${URL}/rest/v1/companies?select=*&limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
})
const rows = await res.json()
if (rows && rows[0]) {
  console.log('COMPANIES COLUMNS:', Object.keys(rows[0]).join(', '))
  console.log('SAMPLE:', JSON.stringify(rows[0], null, 2).slice(0, 800))
} else {
  console.log('companies is empty; trying OpenAPI spec')
  const spec = await fetch(`${URL}/rest/v1/`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
  const j = await spec.json()
  const def = j.definitions?.companies
  if (def) console.log('companies COLUMNS:', Object.keys(def.properties).join(', '))
}

const { data: profiles } = await admin.from('profiles').select('id, email, role, company_id, employee_id, full_name').order('created_at')
console.log('\nPROFILES:')
for (const p of profiles || []) console.log(' -', p.email, '| role:', p.role, '| company:', p.company_id, '| emp:', p.employee_id)

const { data: emps } = await admin.from('employees').select('id, employee_code, email, company_id, profile_id, status')
console.log('\nEMPLOYEES:', (emps || []).length)
for (const e of emps || []) console.log(' -', e.employee_code, '| profile:', e.profile_id, '| company:', e.company_id)

const { data: comps } = await admin.from('companies').select('id, name')
console.log('\nCOMPANIES:')
for (const c of comps || []) console.log(' -', c.name, c.id)

const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 })
console.log('\nAUTH USERS:', (users.users || []).length)
for (const u of users.users || []) console.log(' -', u.email, '| confirmed:', u.email_confirmed_at ? 'yes' : 'no')
