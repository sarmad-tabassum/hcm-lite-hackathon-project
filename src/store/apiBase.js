import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { supabase } from '@/lib/supabaseClient'

const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api' })

/**
 * Wraps every RTK Query request with the Supabase access token.
 *
 * Hardening (fixes the recurring "Not authenticated" error):
 *  - getSession() returns the stored token WITHOUT validating it. If the
 *    laptop slept / the tab was backgrounded past expiry, that token is dead.
 *    So: whenever the token expires within 60s we refresh it first, and if
 *    the refresh itself fails we clear the session cleanly.
 *  - A 401 from the API (server rejected a real token) force-signs-out so
 *    the app bounces to /login instead of showing endless errors.
 */
export const baseQueryWithAuth = async (args, api, extraOptions) => {
  const res = await supabase.auth.getSession()
  let session = res?.data?.session || null

  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0
  if (session && expiresAtMs - Date.now() < 60_000) {
    try {
      const { data } = await supabase.auth.refreshSession()
      if (data?.session) {
        session = data.session
      } else {
        await supabase.auth.signOut()
        session = null
      }
    } catch {
      session = null
    }
  }

  const token = session?.access_token
  const arg = typeof args === 'string' ? { url: args } : { ...args }
  arg.headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(arg.headers || {}),
  }
  const result = await rawBaseQuery(arg, api, extraOptions)
  // Only force-sign-out when a real token was rejected (never during boot races)
  if (result.error?.status === 401 && token) {
    await supabase.auth.signOut()
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Me', 'Org', 'Employees', 'Attendance', 'Leaves', 'Payroll', 'Dashboard', 'Audit', 'Comms', 'Approvals'],
  endpoints: () => ({}),
})
