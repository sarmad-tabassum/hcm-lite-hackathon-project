import { requireRole, needCompany, json } from '@/lib/authz'
import { hrJoinCode, employeeJoinCode, adminJoinCode } from '@/lib/joinCodes'
import { throttle, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/join-codes — Admin-only. Returns this company's join codes
 * for self-registration:
 *   HR code       → /signup/hr
 *   Employee code → /signup/employee
 *   ADMIN code    → /signup ("I have an admin code") — grants FULL admin in
 *                   THIS company, so it must only be shared with trusted
 *                   co-admins.
 */
export async function GET(req) {
  const flood = throttle(`codes:${clientIp(req)}`, 30, 10 * 60 * 1000)
  if (flood) return flood
  const g = await requireRole(req, ['admin'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e

  return json({
    company: { id: g.profile.company_id, name: g.profile.companies?.name || '' },
    admin_code: adminJoinCode(g.profile.company_id),
    hr_code: hrJoinCode(g.profile.company_id),
    employee_code: employeeJoinCode(g.profile.company_id),
  })
}
