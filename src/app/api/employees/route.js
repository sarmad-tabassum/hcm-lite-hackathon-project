import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { provisionAccount } from '@/lib/provision'

const SELECT = `id, employee_code, joining_date, basic_salary, status,
  department_id, designation_id, profile_id,
  departments(name), designations(name), profile:profiles(id, full_name, email, phone, role)`

// Name/email/phone live on the linked profile (every member gets a real account)
function withNames(rows) {
  return (rows || []).map((e) => ({
    ...e,
    full_name: e.profile?.full_name || null,
    email: e.profile?.email || null,
    phone: e.profile?.phone || null,
  }))
}

// GET /api/employees?q=&department_id=&status=
export async function GET(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const departmentId = searchParams.get('department_id')
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('employees')
    .select(SELECT)
    .eq('company_id', g.profile.company_id)
    .order('employee_code')
  if (status && status !== 'all') query = query.eq('status', status)
  if (departmentId) query = query.eq('department_id', departmentId)

  const { data, error } = await query
  if (error) return bad(error.message, 500)
  let rows = withNames(data)
  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((e) =>
      [e.full_name, e.employee_code, e.email].some((v) => String(v || '').toLowerCase().includes(needle))
    )
  }
  return json({ employees: rows })
}

// POST /api/employees — create (admin, hr) and provision a REAL account
export async function POST(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const body = await req.json()
  if (!body.employee_code?.trim() || !body.full_name?.trim())
    return bad('Employee code and full name are required')
  if (!body.email?.trim())
    return bad('Email is required — every employee gets a real account with a password')

  // Role: hr may only add plain employees; admin can add admin/hr/employee
  let role = ['admin', 'hr', 'employee'].includes(body.role) ? body.role : 'employee'
  if (role !== 'employee' && g.profile.role !== 'admin') role = 'employee'

  const { data: dup } = await supabaseAdmin
    .from('employees').select('id').eq('company_id', g.profile.company_id).eq('employee_code', body.employee_code.trim()).maybeSingle()
  if (dup) return bad('Employee code already exists')

  const email = body.email.trim().toLowerCase()

  // The email must be claim-free: another company's member can never be absorbed
  const { data: existingProf } = await supabaseAdmin
    .from('profiles').select('id, company_id').eq('email', email).maybeSingle()
  if (existingProf && existingProf.company_id !== g.profile.company_id)
    return bad('This email already has an account — use a different email')

  const { data, error } = await supabaseAdmin
    .from('employees')
    .insert({
      company_id: g.profile.company_id,
      employee_code: body.employee_code.trim(),
      department_id: body.department_id || null,
      designation_id: body.designation_id || null,
      joining_date: body.joining_date || new Date().toISOString().slice(0, 10),
      basic_salary: Number(body.basic_salary) || 0,
      status: body.status || 'active',
    })
    .select(SELECT).single()
  if (error) return bad(error.message, 500)

  let tempPassword = null
  if (existingProf) {
    // Already a member of this company — just link the employee record
    await supabaseAdmin.from('employees').update({ profile_id: existingProf.id }).eq('id', data.id)
    data.profile_id = existingProf.id
  } else {
    // Fresh email → provision a REAL account with a one-time password
    const r = await provisionAccount({
      email,
      fullName: body.full_name.trim(),
      phone: body.phone?.trim() || null,
      role,
      companyId: g.profile.company_id,
      employeeId: data.employee_code,
    })
    if (r.ok) {
      await supabaseAdmin.from('employees').update({ profile_id: r.profile.id }).eq('id', data.id)
      data.profile_id = r.profile.id
      tempPassword = r.tempPassword
    } else {
      return bad(`Employee saved, but account creation failed: ${r.message || r.code}`, 500)
    }
  }

  const { data: fresh } = await supabaseAdmin.from('employees').select(SELECT).eq('id', data.id).single()
  await logAudit(g.profile, 'employee.create', 'employees', data.id, fresh || data, null, req)
  return json({ employee: withNames([fresh])[0] || data, temp_password: tempPassword })
}
