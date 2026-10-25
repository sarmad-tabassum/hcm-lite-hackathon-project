import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'

// PATCH /api/payroll/[id] — finalize (locks the run)
export async function PATCH(req, ctx) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'finalize') return bad('Unknown action')

  const { data: run } = await supabaseAdmin
    .from('payroll_runs').select('*').eq('id', id).eq('company_id', g.profile.company_id).maybeSingle()
  if (!run) return bad('Payroll run not found', 404)
  if (run.status === 'finalized') return bad('Already finalized')

  const { error } = await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'finalized', finalized_at: new Date().toISOString(), finalized_by: g.user.id })
    .eq('id', id)
  if (error) return bad(error.message, 500)

  await logAudit(g.profile, 'payroll.finalize', 'payroll_runs', id, { month: run.month, year: run.year }, null, req)
  return json({ ok: true })
}
