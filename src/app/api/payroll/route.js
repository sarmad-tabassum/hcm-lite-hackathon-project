import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { karachiNow, monthRange } from '@/lib/time'

// GET /api/payroll?month=&year=  |  ?mine=1
export async function GET(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { searchParams } = new URL(req.url)
  const isPrivileged = ['admin', 'hr'].includes(g.profile.role)

  // Employee: own payslip history
  if (searchParams.get('mine') || !isPrivileged) {
    const { data: emp } = await supabaseAdmin
      .from('employees').select('id').eq('profile_id', g.user.id).maybeSingle()
    if (!emp) return json({ slips: [] })
    const { data, error } = await supabaseAdmin
      .from('payslips')
      .select('id, basic_salary, allowances, deductions, gross, tax, net, details, payroll_runs(id, month, year, status, finalized_at)')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false })
    if (error) return bad(error.message, 500)
    return json({ slips: data || [] })
  }

  const now = karachiNow()
  const month = Number(searchParams.get('month'))
  const year = Number(searchParams.get('year'))

  // No params → list runs
  if (!month || !year) {
    const { data: runs, error } = await supabaseAdmin
      .from('payroll_runs')
      .select('*')
      .eq('company_id', g.profile.company_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    if (error) return bad(error.message, 500)
    return json({ runs: runs || [] })
  }

  const { data: run } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('company_id', g.profile.company_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!run) return json({ run: null, slips: [], totals: null })

  const { data: slips, error } = await supabaseAdmin
    .from('payslips')
    .select('id, basic_salary, allowances, deductions, gross, tax, net, details, employees(employee_code, departments(name), profiles(full_name))')
    .eq('payroll_run_id', run.id)
    .order('employees(employee_code)')
  if (error) return bad(error.message, 500)

  // flatten profile name for the UI
  const enriched = (slips || []).map((s) => ({
    ...s,
    employees: s.employees ? { ...s.employees, full_name: s.employees.profiles?.full_name || s.employees.employee_code } : s.employees,
  }))

  const totals = (slips || []).reduce(
    (s, p) => ({
      gross: s.gross + (Number(p.gross) || 0),
      tax: s.tax + (Number(p.tax) || 0),
      net: s.net + (Number(p.net) || 0),
      count: s.count + 1,
    }),
    { gross: 0, tax: 0, net: 0, count: 0 }
  )
  return json({ run, slips: enriched, totals })
}
