import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const KEEP_EMAIL = 'sarmadtabassum7@gmail.com' // user's real account — kept

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// ⚠ DEAD-MAN'S GUARD — this script wipes the WHOLE database.
// It refuses to run unless you explicitly opt in with HCM_ALLOW_WIPE=1
if (process.env.HCM_ALLOW_WIPE !== '1') {
  console.error('REFUSING to wipe: this deletes ALL users and data. Re-run with HCM_ALLOW_WIPE=1 if you are absolutely sure.')
  process.exit(1)
}

async function resetProduction() {
  // 1) Wipe ALL data tables (order matters for FKs)
  const tables = [
    'payslips', 'payroll_runs', 'attendance', 'leave_requests',
    'notifications', 'announcements', 'audit_logs', 'ai_logs',
    'employees', 'holidays', 'leave_types', 'designations', 'departments', 'companies', 'profiles',
  ]
  for (const t of tables) {
    const { error } = await admin.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.log(`wipe ${t}:`, error.message)
  }

  // 2) Delete ALL auth users except the owner's real account
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 })
  let kept = 0, deleted = 0
  for (const u of users.users) {
    if ((u.email || '').toLowerCase() === KEEP_EMAIL) { kept++; continue }
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) console.log(`delete user ${u.email}:`, error.message)
    else deleted++
  }

  // 3) Verify: table counts + remaining auth users
  const counts = {}
  for (const t of tables) {
    const { count } = await admin.from(t).select('*', { count: 'exact', head: true })
    counts[t] = count
  }
  const { data: after } = await admin.auth.admin.listUsers({ perPage: 200 })
  console.log('kept auth users:', after.users.map(u => u.email))
  console.log('deleted users:', deleted, '| kept:', kept)
  console.log('row counts:', JSON.stringify(counts))
  const allZero = Object.values(counts).every(c => c === 0)
  console.log(allZero && after.users.length === 1 ? 'RESET OK — fresh start ready' : 'RESET INCOMPLETE — check above')
}

resetProduction()
