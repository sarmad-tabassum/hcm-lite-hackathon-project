import { createClient } from '@supabase/supabase-js'
const URL = 'https://beydmjrjhpsqqcqoszal.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

// pull attendance table columns from the API catalog
const res = await fetch(`${URL}/rest/v1/attendance?limit=1`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
})
const rows = await res.json()
if (rows && rows[0]) {
  console.log('attendance columns:', Object.keys(rows[0]).join(', '))
} else {
  console.log('no attendance rows exist; OpenAPI needed')
  const cat = await fetch(`${URL}/rest/v1/?apikey=${SERVICE}`, { headers: { Authorization: `Bearer ${SERVICE}` } })
  const defs = (await cat.json()).definitions
  console.log('attendance columns (schema):', Object.keys(defs?.attendance?.properties || {}).join(', '))
}
