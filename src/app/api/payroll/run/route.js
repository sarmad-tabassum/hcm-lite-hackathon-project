import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { karachiNow, monthRange } from '@/lib/time'
import { calcPayslip } from '@/lib/payroll'

// POST /api/payroll/run — { month, year }: Gross = 1.5 x basic + slab tax (idempotent while draft)
export async function POST(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const cid = g.profile.company_id
  const body = await req.json()
  const now = karachiNow()
  const month = Number(body.month) || Number(now.date.slice(5, 7))
  const year = Number(body.year) || Number(now.date.slice(0, 4))
  if (!(month >= 1 && month <= 12)) return bad('Invalid month')

  const { start, end } = monthRange(year, month)
  const { data: existingRun } = await supabaseAdmin
    .from('payroll_runs').select('*').eq('company_id', cid).eq('month', month).eq('year', year).maybeSingle()
  if (existingRun?.status === 'finalized') return bad('Payroll for this month is finalized and locked')

  // Eligible employees: active, joined before month end
  const { data: employees, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('id, employee_code, basic_salary')
    .eq('company_id', cid)
    .eq('status', 'active')
    .lte('joining_date', end)
    .order('employee_code')
  if (empErr) return bad(empErr.message, 500)
  if (!employees?.length) return bad('No active employees eligible for this month')

  // Attendance stats for the month (single query)
  const { data: attRows } = await supabaseAdmin
    .from('attendance')
    .select('employee_id, status')
    .gte('attendance_date', start)
    .lte('attendance_date', end)
  const stats = new Map()
  for (const r of attRows || []) {
    const s = stats.get(r.employee_id) || { present: 0, late: 0, half_day: 0, on_leave: 0, absent: 0 }
    s[r.status] = (s[r.status] || 0) + 1
    stats.set(r.employee_id, s)
  }

  // Create or reset run
  let run = existingRun
  if (run) {
    await supabaseAdmin.from('payslips').delete().eq('payroll_run_id', run.id)
  } else {
    const { data: created, error: cErr } = await supabaseAdmin
      .from('payroll_runs')
      .insert({ company_id: cid, month, year, status: 'draft' })
      .select().single()
    if (cErr) return bad(cErr.message, 500)
    run = created
  }

  const slips = employees.map((emp) => {
    const calc = calcPayslip(emp.basic_salary)
    const s = stats.get(emp.id) || { present: 0, late: 0, half_day: 0, on_leave: 0, absent: 0 }
    return {
      payroll_run_id: run.id,
      employee_id: emp.id,
      basic_salary: Number(emp.basic_salary) || 0,
      allowances: calc.allowances,
      deductions: 0,
      gross: calc.gross,
      tax: calc.tax,
      net: calc.net,
      details: {
        formula: 'gross = 1.5 x basic; tax = annual slab / 12',
        present_days: s.present + s.late,
        late_days: s.late,
        half_days: s.half_day,
        leave_days: s.on_leave,
      },
    }
  })
  const { error: insErr } = await supabaseAdmin.from('payslips').insert(slips)
  if (insErr) return bad('Payslip generation failed: ' + insErr.message, 500)

  await logAudit(g.profile, 'payroll.run', 'payroll_runs', run.id, { month, year, employees: slips.length }, null, req)
  return json({ run, employees: slips.length })
}
