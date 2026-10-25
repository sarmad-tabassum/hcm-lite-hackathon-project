import { supabaseAdmin } from './supabaseAdmin'
import { karachiNow, monthRange } from './time'
import { workingDays } from './leave'

// ---------- Tool schemas (sent to Groq / OpenAI-compatible API) ----------
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_headcount',
      description: 'Count of active employees, optionally filtered by department name',
      parameters: {
        type: 'object',
        properties: { department: { type: 'string', description: 'Department name (optional)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: 'Attendance counts by status (present, late, half_day, on_leave) for a date. Default: today',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD (optional)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_late_comers',
      description: 'List of employees who were late on a date. Default: today',
      parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD (optional)' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leave_summary',
      description: 'Leave requests in a month grouped by status and by leave type. Default: current month',
      parameters: {
        type: 'object',
        properties: { month: { type: 'integer' }, year: { type: 'integer' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_leave_balance',
      description: 'Remaining leave quota per leave type for the CURRENT logged-in user',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payroll_summary',
      description: 'Payroll totals (gross, tax, net, employees paid) for a month. Default: current month',
      parameters: {
        type: 'object',
        properties: { month: { type: 'integer' }, year: { type: 'integer' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_employees',
      description: 'Search active employees by name or employee code, optionally within a department',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or code fragment' },
          department: { type: 'string', description: 'Department name (optional)' },
        },
      },
    },
  },
]

const ADMIN_HR_TOOLS = AI_TOOLS.map((t) => t.function.name)
const EMPLOYEE_TOOLS = ['get_my_leave_balance']

export function toolsForRole(role) {
  const allowed = role === 'admin' || role === 'hr' ? ADMIN_HR_TOOLS : EMPLOYEE_TOOLS
  return AI_TOOLS.filter((t) => allowed.includes(t.function.name))
}

// ---------- Runner ----------
async function getCompanyEmployee(profile) {
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, employee_code, department_id, joining_date, basic_salary')
    .eq('profile_id', profile.id)
    .maybeSingle()
  return data
}

async function getHolidaySet(companyId, year) {
  const { data } = await supabaseAdmin
    .from('holidays')
    .select('holiday_date')
    .eq('company_id', companyId)
    .gte('holiday_date', `${year}-01-01`)
    .lte('holiday_date', `${year}-12-31`)
  return new Set((data || []).map((h) => h.holiday_date))
}

export async function runAiTool(name, args, profile) {
  const cid = profile.company_id
  const role = profile.role
  const isPrivileged = role === 'admin' || role === 'hr'
  const a = args || {}
  const now = karachiNow()
  const today = now.date
  const curMonth = Number(today.slice(5, 7))
  const curYear = Number(today.slice(0, 4))

  if (!isPrivileged && name !== 'get_my_leave_balance') {
    return { error: 'Not permitted for your role. You can only ask about your own leave balance.' }
  }
  if (!cid && name !== 'get_my_leave_balance') return { error: 'No company linked.' }

  switch (name) {
    case 'get_headcount': {
      let q = supabaseAdmin.from('employees').select('id, departments(name)').eq('company_id', cid).eq('status', 'active')
      if (a.department) q = q.eq('departments.name', a.department)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { headcount: data.length, department: a.department || 'all' }
    }
    case 'get_attendance_summary': {
      const date = a.date || today
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .select('status, employees!inner(company_id, status)')
        .eq('employees.company_id', cid)
        .eq('attendance_date', date)
      if (error) return { error: error.message }
      const counts = { present: 0, late: 0, half_day: 0, on_leave: 0, absent: 0 }
      for (const r of data || []) counts[r.status] = (counts[r.status] || 0) + 1
      return { date, marked: (data || []).length, counts }
    }
    case 'get_late_comers': {
      const date = a.date || today
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .select('check_in, notes, employees!inner(company_id, employee_code, departments(name), profiles(full_name))')
        .eq('employees.company_id', cid)
        .eq('attendance_date', date)
        .eq('status', 'late')
      if (error) return { error: error.message }
      return {
        date,
        count: (data || []).length,
        employees: (data || []).map((r) => ({
          code: r.employees.employee_code,
          name: r.employees.profiles?.full_name || r.employees.employee_code,
          department: r.employees.departments?.name || '—',
          check_in: r.check_in,
          note: r.notes,
        })),
      }
    }
    case 'get_leave_summary': {
      const month = a.month || curMonth
      const year = a.year || curYear
      const { start, end } = monthRange(year, month)
      const { data, error } = await supabaseAdmin
        .from('leave_requests')
        .select('status, start_date, end_date, leave_types(name), employees!inner(company_id)')
        .eq('employees.company_id', cid)
        .lte('start_date', end)
        .gte('end_date', start)
      if (error) return { error: error.message }
      const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
      const byType = {}
      for (const r of data || []) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1
        const t = r.leave_types?.name || 'Unknown'
        byType[t] = (byType[t] || 0) + 1
      }
      return { month, year, total: (data || []).length, byStatus, byType }
    }
    case 'get_my_leave_balance': {
      const me = await getCompanyEmployee(profile)
      if (!me) return { error: 'No employee record is linked to your account yet.' }
      const year = curYear
      const [{ data: types }, { data: approved }, holidays] = await Promise.all([
        supabaseAdmin.from('leave_types').select('id, name, days_allowed').eq('company_id', profile.company_id),
        supabaseAdmin
          .from('leave_requests')
          .select('leave_type_id, start_date, end_date')
          .eq('employee_id', me.id)
          .eq('status', 'approved')
          .gte('start_date', `${year}-01-01`)
          .lte('start_date', `${year}-12-31`),
        getHolidaySet(profile.company_id, year),
      ])
      const balances = (types || []).map((t) => {
        const used = (approved || [])
          .filter((l) => l.leave_type_id === t.id)
          .reduce((s, l) => s + workingDays(l.start_date, l.end_date, holidays).length, 0)
        return { type: t.name, quota: t.days_allowed, used, remaining: (t.days_allowed || 0) - used }
      })
      return { year, balances }
    }
    case 'get_payroll_summary': {
      const month = a.month || curMonth
      const year = a.year || curYear
      const { data: run } = await supabaseAdmin
        .from('payroll_runs')
        .select('id, status')
        .eq('company_id', cid)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()
      if (!run) return { month, year, exists: false, message: 'No payroll run for this month yet.' }
      const { data: slips } = await supabaseAdmin
        .from('payslips')
        .select('basic_salary, allowances, gross, tax, net')
        .eq('payroll_run_id', run.id)
      const sum = (k) => (slips || []).reduce((s, p) => s + (Number(p[k]) || 0), 0)
      return {
        month, year, exists: true, status: run.status, employees_paid: (slips || []).length,
        total_gross: sum('gross'), total_tax: sum('tax'), total_net: sum('net'),
      }
    }
    case 'search_employees': {
      const { data, error } = await supabaseAdmin
        .from('employees')
        .select('employee_code, status, departments(name), designations(name), profile:profiles(full_name, email)')
        .eq('company_id', cid)
        .limit(50)
      if (error) return { error: error.message }
      const needle = String(a.query || '').toLowerCase()
      const filtered = (data || [])
        .filter((e) => !needle || [e.employee_code, e.profile?.full_name, e.profile?.email].some((v) => String(v || '').toLowerCase().includes(needle)))
        .filter((e) => !a.department || (e.departments?.name || '').toLowerCase() === String(a.department).toLowerCase())
        .slice(0, 10)
      return {
        count: filtered.length,
        employees: filtered.map((e) => ({
          code: e.employee_code, name: e.profile?.full_name, email: e.profile?.email,
          department: e.departments?.name, designation: e.designations?.name, status: e.status,
        })),
      }
    }
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export function buildSystemPrompt(profile) {
  const now = karachiNow()
  return [
    `You are "HCM Assistant" for ${profile.companies?.name || 'the company'} inside the HCM Lite app.`,
    `Today is ${now.date} (Asia/Karachi). The current user is ${profile.full_name} with role "${profile.role}".`,
    '',
    'RULES:',
    '1. For anything numeric or list-like, call the matching tool FIRST and answer only from tool results. Never invent numbers.',
    '2. If a tool returns an error about permissions, tell the user they do not have access to that information.',
    '3. Company policy facts: office hours per company settings; check-in after 09:15 counts as LATE; under 5 worked hours is a HALF DAY; leave needs available quota, no overlapping request; weekends (Sat/Sun) and holidays are not counted as leave days; gross salary = 1.5 x basic salary; tax follows the annual slab (0% up to 600k, 5% to 1.2M, 10% to 2.4M, 15% to 3.6M, 20% above; annual figures in PKR).',
    '4. Currency is PKR. Be brief. Reply in PLAIN TEXT only — short sentences or simple dash lists; NEVER use markdown tables, pipes, asterisks or headings (the chat UI renders raw text). Never reveal other employees\u2019 salaries or payslips to non-admin users.',
    '5. If data is missing, say exactly what could not be found.',
  ].join('\n')
}
