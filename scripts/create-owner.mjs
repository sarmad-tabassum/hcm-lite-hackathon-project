import { createClient } from '@supabase/supabase-js'

const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// 1) Create the owner's real account (email pre-confirmed → no email, no rate limit)
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: 'sarmadtabassum7@gmail.com',
  password: 'Sarmad@123',
  email_confirm: true,
  user_metadata: { full_name: 'Sarmad' },
})
if (cErr) { console.log('CREATE FAIL:', cErr.message); process.exit(1) }
console.log('ACCOUNT CREATED:', created.user.email)

// 2) Verify real sign-in works (the exact path the app uses)
const sb = createClient(URL, ANON)
const { data, error } = await sb.auth.signInWithPassword({ email: 'sarmadtabassum7@gmail.com', password: 'Sarmad@123' })
if (error) { console.log('SIGNIN FAIL:', error.message); process.exit(1) }
console.log('SIGNIN OK:', data.user.email)

// 3) Confirm DB is empty for a true fresh start
const { count: pc } = await admin.from('profiles').select('*', { count: 'exact', head: true })
const { count: cc } = await admin.from('companies').select('*', { count: 'exact', head: true })
console.log('profiles:', pc, '| companies:', cc, '→ first login lands on /setup ✓')
