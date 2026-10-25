import crypto from 'crypto'

/**
 * Company join codes — HMAC-derived, stored NOWHERE.
 *
 * Why not a DB column? The deployed schema has no spare column and we avoid
 * migrations entirely: a code is `HMAC(secret, companyId + scope)` truncated
 * and formatted. The secret lives only in server env (JOIN_CODE_SECRET, with
 * the service key as fallback), so codes cannot be forged or guessed offline,
 * and they never touch the database.
 *
 * Format:  HCM-HR-AB12-CD34   (HR seats)
 *          HCM-EMP-AB12-CD34  (Employee seats)
 *          HCM-ADM-AB12-CD34  (Admin seats — share ONLY with a trusted co-admin)
 *
 * Verification: we only receive a code (not a company id), so we recompute
 * per company — companies per instance are few, this is O(n) and fine.
 */
const SECRET = process.env.JOIN_CODE_SECRET || process.env.SUPABASE_SERVICE_KEY || 'hcm-lite-local-secret'

function digestFor(companyId, scope) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`hcm-join:${companyId}:${scope}`)
    .digest('hex')
    .toUpperCase()
}

export function hrJoinCode(companyId) {
  const d = digestFor(companyId, 'hr')
  return `HCM-HR-${d.slice(0, 4)}-${d.slice(4, 8)}`
}

export function employeeJoinCode(companyId) {
  const d = digestFor(companyId, 'employee')
  return `HCM-EMP-${d.slice(0, 4)}-${d.slice(4, 8)}`
}

export function adminJoinCode(companyId) {
  const d = digestFor(companyId, 'admin')
  return `HCM-ADM-${d.slice(0, 4)}-${d.slice(4, 8)}`
}

/** The code prefix expected for a scope (used for cheap pre-validation) */
export function codePrefixFor(scope) {
  return { hr: 'HCM-HR-', employee: 'HCM-EMP-', admin: 'HCM-ADM-' }[scope] || 'HCM-'
}

/** Constant-time compare for one presented code (any scope) */
export function verifyJoinCode(companyId, scope, presented) {
  const expected =
    scope === 'hr' ? hrJoinCode(companyId)
    : scope === 'admin' ? adminJoinCode(companyId)
    : employeeJoinCode(companyId)
  const given = String(presented || '').trim().toUpperCase()
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}
