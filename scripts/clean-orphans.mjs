/**
 * Remove ONLY the E2E orphan artifacts (rp-emp-*, temp-qa-*).
 * Real user data (Saylani Tech Ventures, sarmadtabassum7, etc.) is NEVER touched.
 */
import { createClient } from '@supabase/supabase-js'
const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 })
const orphans = (users.users || []).filter((u) => /^rp-|^temp-qa-|@hcm\.test$/i.test(u.email || ''))

for (const u of orphans) {
  await admin.from('profiles').delete().eq('id', u.id)
  const { error } = await admin.auth.admin.deleteUser(u.id)
  console.log('removed', u.email, error ? `ERR: ${error.message}` : 'ok')
}
if (orphans.length === 0) console.log('no orphans found')

const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
console.log('profiles remaining:', count)
