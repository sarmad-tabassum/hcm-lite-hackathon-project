import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const { data: company } = await admin.from('companies').select('id,name').limit(1).maybeSingle()
  if (!company) throw new Error('No company found — create it in the UI first')
  console.log('company:', company.name)

  const { data: adminProfile } = await admin.from('profiles').select('id, full_name').eq('email', 'e2e-admin@hcm.test').maybeSingle()

  // Second user: employee
  const { data: empUser, error: euErr } = await admin.auth.admin.createUser({
    email: 'e2e-emp@hcm.test',
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: { full_name: 'Sara Ahmed' },
  })
  if (euErr && !euErr.message.includes('already')) throw euErr
  let empId = empUser?.user?.id
  if (!empId) {
    const { data: found } = await admin.auth.admin.listUsers()
    empId = found.users.find((u) => u.email === 'e2e-emp@hcm.test')?.id
  }
  console.log('emp user:', empId)

  // Ensure a profiles row exists for the employee user (normally done by /api/auth/sync at first login)
  if (empId) {
    await admin.from('profiles').upsert({ id: empId, full_name: 'Sara Ahmed', email: 'e2e-emp@hcm.test', role: 'employee' })
  }

  // Holiday
  await admin.from('holidays').upsert(
    { company_id: company.id, name: 'Iqbal Day', holiday_date: '2025-11-09' },
    { onConflict: 'company_id,holiday_date' }
  )

  // Designation
  const { data: desig } = await admin
    .from('designations')
    .upsert({ company_id: company.id, name: 'Software Engineer' }, { onConflict: 'company_id,name' })
    .select()
    .maybeSingle()
  const desigId = desig?.id || (await admin.from('designations').select('id').eq('company_id', company.id).eq('name', 'Software Engineer').maybeSingle()).data?.id

  // Employees — NOTE: full_name/email columns come from PATCH.sql; insert defensively
  const base = { company_id: company.id, employee_code: 'EMP-001', joining_date: '2025-01-10', basic_salary: 100000, status: 'active', designation_id: desigId || null }
  const patchCols = await admin
    .from('employees')
    .select('employee_code, full_name, email, phone')
    .limit(1)
  const hasPatch = !patchCols.error
  console.log('PATCH.sql applied:', hasPatch, hasPatch ? '' : `(${patchCols.error.message})`)

  const { data: existing } = await admin.from('employees').select('id, employee_code').eq('company_id', company.id)
  const e1 = existing?.find((e) => e.employee_code === 'EMP-001')
  const e2 = existing?.find((e) => e.employee_code === 'EMP-002')

  if (!e1) {
    const { data, error } = await admin
      .from('employees')
      .insert(hasPatch ? { ...base, full_name: 'E2E Admin', email: 'e2e-admin@hcm.test', profile_id: adminProfile?.id } : { ...base, profile_id: adminProfile?.id })
      .select('id')
      .single()
    if (error) throw error
    console.log('EMP-001 created')
  }
  if (!e2) {
    const { data, error } = await admin
      .from('employees')
      .insert(hasPatch ? { company_id: company.id, employee_code: 'EMP-002', full_name: 'Sara Ahmed', email: 'e2e-emp@hcm.test', joining_date: '2025-02-01', basic_salary: 80000, status: 'active', profile_id: empId, designation_id: desigId || null } : { company_id: company.id, employee_code: 'EMP-002', joining_date: '2025-02-01', basic_salary: 80000, status: 'active', profile_id: empId, designation_id: desigId || null })
      .select('id')
      .single()
    if (error) throw error
    console.log('EMP-002 created')
  }

  // Link profiles to company (as sync would for matched emails)
  if (adminProfile) await admin.from('profiles').update({ company_id: company.id }).eq('id', adminProfile.id)
  if (empId) await admin.from('profiles').update({ company_id: company.id }).eq('id', empId)

  const { data: depts } = await admin.from('departments').select('name').eq('company_id', company.id)
  const { data: lts } = await admin.from('leave_types').select('name, days_allowed').eq('company_id', company.id)
  console.log('departments:', depts?.map((d) => d.name), 'leaveTypes:', lts)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
