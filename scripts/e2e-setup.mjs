import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// ⚠ DEAD-MAN'S GUARD — this script wipes the WHOLE database.
// It refuses to run unless you explicitly opt in with HCM_ALLOW_WIPE=1
if (process.env.HCM_ALLOW_WIPE !== '1') {
  console.error('REFUSING to wipe: this deletes ALL users and data. Re-run with HCM_ALLOW_WIPE=1 if you are absolutely sure.')
  process.exit(1)
}

// Wipe everything back to first-run state
async function cleanup() {
  const tables = [
    'payslips', 'payroll_runs', 'attendance', 'leave_requests',
    'notifications', 'announcements', 'audit_logs', 'ai_logs',
    'employees', 'holidays', 'leave_types', 'designations', 'departments', 'companies', 'profiles',
  ]
  for (const t of tables) {
    const { error } = await admin.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.log(`cleanup ${t}:`, error.message)
  }
  const { data: users } = await admin.auth.admin.listUsers()
  for (const u of users.users) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) console.log(`delete user ${u.email}:`, error.message)
  }
  console.log('cleanup done')
}

async function main() {
  await cleanup()

  // Create the E2E admin (email pre-confirmed so we can log in via UI)
  const { data, error } = await admin.auth.admin.createUser({
    email: 'e2e-admin@hcm.test',
    password: 'TestPass123!',
    email_confirm: true,
    user_metadata: { full_name: 'E2E Admin' },
  })
  if (error) throw error
  console.log('created e2e admin:', data.user.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
