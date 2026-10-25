import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const APP = 'http://localhost:3000'

// 1) Real sign-in (same as browser does)
const sb = createClient(URL, ANON)
const { data, error } = await sb.auth.signInWithPassword({ email: 'sarmadtabassum7@gmail.com', password: 'Sarmad@123' })
if (error) { console.log('1 SIGNIN FAIL:', error.message); process.exit(1) }
console.log('1 SIGNIN OK')

// 2) POST /api/auth/sync (what login page does right after sign-in)
let res = await fetch(`${APP}/api/auth/sync`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
  body: '{}',
})
const sync = await res.json()
console.log('2 SYNC', res.status, '| company_id:', sync?.profile?.company_id, '| role:', sync?.profile?.role, '| isFirstUser:', sync?.isFirstUser)

// 3) GET /api/auth/me
res = await fetch(`${APP}/api/auth/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } })
const me = await res.json()
console.log('3 ME', res.status, '| profile:', me?.profile ? `${me.profile.full_name}/${me.profile.role}/company=${me.profile.company_id}` : 'MISSING')

// 4) Pages reachable
for (const p of ['/login', '/setup', '/dashboard', '/dashboard/']) {
  const r = await fetch(`${APP}${p}`, { redirect: 'manual' })
  console.log(`4 PAGE ${p} →`, r.status)
}
console.log('EXPECT: sync/me 200, fresh profile company=null, role admin → login will route to /setup')
