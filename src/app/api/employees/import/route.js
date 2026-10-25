import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/audit'
import { provisionAccount } from '@/lib/provision'

/**
 * POST /api/employees/import
 * Body: { rows: [...] } — rows come from papaparse (header row parsed on the client).
 * Expected columns: employee_code, full_name, email (required), phone, department,
 *                   designation, joining_date (YYYY-MM-DD), basic_salary, status
 * Departments/designations are auto-created by name. Existing codes are updated.
 * Every row provisions a REAL account — the response returns one-time credentials.
 */
export async function POST(req) {
  const g = await requireRole(req, ['admin', 'hr'])
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const cid = g.profile.company_id
  const { rows } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) return bad('No rows to import')
  if (rows.length > 500) return bad('Maximum 500 rows per import')

  const [{ data: depts }, { data: desigs }, { data: existing }] = await Promise.all([
    supabaseAdmin.from('departments').select('id, name').eq('company_id', cid),
    supabaseAdmin.from('designations').select('id, name').eq('company_id', cid),
    supabaseAdmin.from('employees').select('id, employee_code, profile_id').eq('company_id', cid),
  ])
  const deptMap = new Map((depts || []).map((d) => [d.name.toLowerCase(), d.id]))
  const desigMap = new Map((desigs || []).map((d) => [d.name.toLowerCase(), d.id]))
  const codeMap = new Map((existing || []).map((x) => [x.employee_code, x]))

  const result = { inserted: 0, updated: 0, skipped: 0, errors: [], credentials: [] }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const code = String(r.employee_code || '').trim()
    const name = String(r.full_name || '').trim()
    const email = String(r.email || '').trim().toLowerCase()
    if (!code || !name || !email) {
      result.skipped++
      result.errors.push(`Row ${i + 2}: employee_code, full_name and email are required`)
      continue
    }

    // Resolve / auto-create department + designation
    let departmentId = null
    const deptName = String(r.department || '').trim()
    if (deptName) {
      if (!deptMap.has(deptName.toLowerCase())) {
        const { data: nd } = await supabaseAdmin
          .from('departments').insert({ company_id: cid, name: deptName }).select('id').single()
        if (nd) { deptMap.set(deptName.toLowerCase(), nd.id); departmentId = nd.id }
      } else departmentId = deptMap.get(deptName.toLowerCase())
    }
    let designationId = null
    const desigName = String(r.designation || '').trim()
    if (desigName) {
      if (!desigMap.has(desigName.toLowerCase())) {
        const { data: nd } = await supabaseAdmin
          .from('designations').insert({ company_id: cid, name: desigName }).select('id').single()
        if (nd) { desigMap.set(desigName.toLowerCase(), nd.id); designationId = nd.id }
      } else designationId = desigMap.get(desigName.toLowerCase())
    }

    const orgFields = {
      department_id: departmentId,
      designation_id: designationId,
      joining_date: r.joining_date || new Date().toISOString().slice(0, 10),
      basic_salary: Number(r.basic_salary) || 0,
      status: ['active', 'inactive', 'terminated'].includes(r.status) ? r.status : 'active',
    }

    const known = codeMap.get(code)
    if (known) {
      // Update org fields on the row; name/email/phone on the linked profile
      const { error } = await supabaseAdmin.from('employees').update(orgFields).eq('id', known.id)
      if (error) { result.skipped++; result.errors.push(`Row ${i + 2}: update failed (${error.message.slice(0, 60)})`); continue }
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id, company_id, email').eq('email', email).maybeSingle()
      if (prof && prof.id === known.profile_id) {
        await supabaseAdmin.from('profiles')
          .update({ full_name: name, phone: String(r.phone || '').trim() || null }).eq('id', prof.id)
      } else if (prof && prof.company_id === cid && !known.profile_id) {
        await supabaseAdmin.from('employees').update({ profile_id: prof.id }).eq('id', known.id)
        codeMap.set(code, { ...known, profile_id: prof.id })
      }
      // email belongs to nobody or to another workspace → keep the row, skip account changes
      result.updated++
      continue
    }

    // New row — provision a real account first (so every member can sign in)
    const prov = await provisionAccount({
      email,
      fullName: name,
      phone: String(r.phone || '').trim() || null,
      role: 'employee',
      companyId: cid,
      employeeId: code,
    })
    let profileId = null
    if (prov.ok) {
      profileId = prov.profile.id
      result.credentials.push({ employee_code: code, email, full_name: name, password: prov.tempPassword })
    } else if (prov.code === 'exists') {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('id, company_id').eq('email', email).maybeSingle()
      if (prof && prof.company_id === cid) profileId = prof.id
      else { result.skipped++; result.errors.push(`Row ${i + 2} (${email}): email already has an account`); continue }
    } else {
      result.skipped++
      result.errors.push(`Row ${i + 2} (${email}): account failed — ${prov.message || prov.code}`)
      continue
    }

    const { data: emp, error } = await supabaseAdmin
      .from('employees')
      .insert({ company_id: cid, employee_code: code, profile_id: profileId, ...orgFields })
      .select('id').single()
    if (error) {
      result.skipped++
      result.errors.push(`Row ${i + 2}: ${error.message.slice(0, 60)}`)
      continue
    }
    result.inserted++
    codeMap.set(code, { id: emp.id, employee_code: code, profile_id: profileId })
  }

  await logAudit(g.profile, 'employee.import', 'employees', null,
    { inserted: result.inserted, updated: result.updated, skipped: result.skipped }, null, req)
  return json(result)
}
