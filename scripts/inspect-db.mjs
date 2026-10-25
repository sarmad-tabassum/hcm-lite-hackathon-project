import { createClient } from '@supabase/supabase-js'
const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: profiles } = await admin.from('profiles').select('id, email, role, company_id, employee_id, full_name').order('created_at')
console.log('PROFILES:')
for (const p of profiles || []) console.log(' -', p.email, '| role:', p.role, '| company:', p.company_id, '| emp_id:', p.employee_id)

const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 })
console.log('\nAUTH USERS:')
for (const u of users.users || []) console.log(' -', u.email, '| confirmed:', u.email_confirmed_at ? 'yes' : 'no')

const { data: emps } = await admin.from('employees').select('id, employee_code, email, company_id, profile_id, status')
console.log('\nEMPLOYEES:')
for (const e of emps || []) console.log(' -', e.employee_code, e.email, '| company:', e.company_id, '| profile:', e.profile_id)

const { data: comps } = await admin.from('companies').select('id, name')
console.log('\nCOMPANIES:')
for (const c of comps || []) console.log(' -', c.name, c.id)
