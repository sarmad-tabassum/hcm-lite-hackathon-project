import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const sb = createClient(URL, ANON)
const { data, error } = await sb.auth.signInWithPassword({
  email: 'sarmadtabassum7@gmail.com',
  password: 'Sarmad@123',
})
if (error) { console.log('SIGNIN FAIL:', error.message); process.exit(1) }
console.log('SIGNIN OK:', data.user.email, '| confirmed:', !!data.user.email_confirmed_at)

// profile must NOT exist yet (fresh) → sync will recreate it on first login → /setup
const admin = createClient(URL, process.env.SUPABASE_SERVICE_KEY)
const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true })
  .eq('id', data.user.id)
console.log('profile rows for user:', count, count === 0 ? '→ first login will land on /setup ✓' : '→ profile exists')
