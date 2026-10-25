'use client'
import { useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Copy, UserPlus, Upload, Download, Pencil, Trash2, Search, Users, AlertTriangle, KeyRound } from 'lucide-react'
import {
  useGetEmployeesQuery, useCreateEmployeeMutation, useUpdateEmployeeMutation,
  useTerminateEmployeeMutation, useImportEmployeesMutation,
} from '@/store/services/employeesApi'
import { useGetDepartmentsQuery, useGetDesignationsQuery } from '@/store/services/orgApi'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, Loading, EmptyState, PageHeader, Avatar } from '@/components/ui/bits'
import { pkr, fmtDate } from '@/lib/utils'

const CSV_COLUMNS = ['employee_code', 'full_name', 'email', 'phone', 'department', 'designation', 'joining_date', 'basic_salary', 'status']

function EmployeeDialog({ open, onOpenChange, employee, departments, designations, profileId, onCreated }) {
  const me = useSelector((s) => s.auth.profile)
  const isEdit = !!employee
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation()
  const [updateEmployee, { isLoading: updating }] = useUpdateEmployeeMutation()
  const [form, setForm] = useState(() => ({
    employee_code: employee?.employee_code || '',
    full_name: employee?.full_name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    department_id: employee?.department_id || '',
    designation_id: employee?.designation_id || '',
    joining_date: employee?.joining_date || new Date().toISOString().slice(0, 10),
    basic_salary: employee?.basic_salary ?? '',
    status: employee?.status || 'active',
    role: 'employee',
  }))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const busy = creating || updating

  async function save() {
    if (!form.email?.trim()) {
      toast.error('Email is required — every employee gets a real account')
      return
    }
    try {
      const body = {
        ...form,
        basic_salary: Number(form.basic_salary) || 0,
        department_id: form.department_id || null,
        designation_id: form.designation_id || null,
      }
      if (isEdit) {
        await updateEmployee({ id: employee.id, ...body }).unwrap()
        toast.success('Employee updated')
      } else {
        const res = await createEmployee(body).unwrap()
        toast.success('Employee added — account is ready')
        if (res?.temp_password && onCreated) onCreated({ email: body.email, password: res.temp_password, name: body.full_name })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit employee' : 'Add employee'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Update the employee record.'
            : 'With an email, a real account is created instantly — you will get a one-time password to share.'}
        </DialogDescription>
        <DialogClose onOpenChange={onOpenChange} />
      </DialogHeader>
      <DialogBody>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee code *">
            <Input required placeholder="EMP-001" value={form.employee_code} onChange={set('employee_code')} disabled={isEdit} />
          </Field>
          <Field label="Full name *">
            <Input required placeholder="Ali Khan" value={form.full_name} onChange={set('full_name')} />
          </Field>
          <Field label="Email *" hint="A real account is created with this email">
            <Input type="email" required placeholder="ali@company.com" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <Input placeholder="+92 3xx xxxxxxx" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Department">
            <Select value={form.department_id} onChange={set('department_id')}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Designation">
            <Select value={form.designation_id} onChange={set('designation_id')}>
              <option value="">— None —</option>
              {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Joining date">
            <Input type="date" value={form.joining_date} onChange={set('joining_date')} />
          </Field>
          <Field label="Basic salary (PKR)">
            <Input type="number" min="0" placeholder="50000" value={form.basic_salary} onChange={set('basic_salary')} />
          </Field>
          {isEdit && (
            <Field label="Status">
              <Select value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </Select>
            </Field>
          )}
          {!isEdit && me?.role === 'admin' && (
            <Field label="Workspace role" hint="Admin/HR can manage the whole company">
              <Select value={form.role} onChange={set('role')}>
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          )}
        </div>
        {isEdit && profileId && (
          <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            Account linked — role is managed from Organization → Roles.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}</Button>
      </DialogFooter>
    </Dialog>
  )
}

function ImportDialog({ open, onOpenChange }) {
  const [importEmployees, { isLoading }] = useImportEmployeesMutation()
  const [rows, setRows] = useState(null)
  const fileRef = useRef(null)

  const [importResult, setImportResult] = useState(null)

  function downloadCredentials() {
    if (!importResult?.credentials?.length) return
    const csv = Papa.unparse(importResult.credentials.map((c) => ({
      employee_code: c.employee_code, full_name: c.full_name, email: c.email, temp_password: c.password,
    })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'account_credentials.csv'
    a.click()
  }

  function downloadTemplate() {
    const csv = Papa.unparse([
      {
        employee_code: 'EMP-101', full_name: 'Ayesha Malik', email: 'ayesha@company.com',
        phone: '+92 300 1234567', department: 'Engineering', designation: 'Software Engineer',
        joining_date: '2026-01-15', basic_salary: 120000, status: 'active',
      },
    ])
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'employees_template.csv'
    a.click()
  }

  function parseFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const clean = res.data.map((r) => {
          const o = {}
          for (const c of CSV_COLUMNS) o[c] = r[c] ?? ''
          return o
        })
        setRows(clean)
      },
      error: () => toast.error('Could not parse the CSV file'),
    })
  }

  async function doImport() {
    try {
      const res = await importEmployees(rows).unwrap()
      setImportResult(res)
      toast.success(`Imported: ${res.inserted} added, ${res.updated} updated, ${res.skipped} skipped`)
      if (res.errors?.length) toast.warning(res.errors.slice(0, 2).join(' | '))
      setRows(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(err?.data?.error || 'Import failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Import employees from CSV</DialogTitle>
        <DialogDescription>Columns: {CSV_COLUMNS.join(', ')}</DialogDescription>
        <DialogClose onOpenChange={onOpenChange} />
      </DialogHeader>
      <DialogBody>
        {importResult ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{importResult.credentials?.length || 0}</strong> new account(s) created —
              share the one-time passwords privately.
            </p>
            {importResult.credentials?.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>One-time password</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.credentials.map((c) => (
                      <TableRow key={c.email}>
                        <TableCell>{c.employee_code}</TableCell>
                        <TableCell>{c.full_name}</TableCell>
                        <TableCell className="truncate">{c.email}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold">{c.password}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex gap-2">
              {importResult.credentials?.length > 0 && (
                <Button variant="outline" onClick={downloadCredentials}><Download /> Download credentials CSV</Button>
              )}
              <Button onClick={() => { setImportResult(null); onOpenChange(false) }}>Done</Button>
            </div>
            {importResult.errors?.length > 0 && (
              <p className="text-xs text-muted-foreground">{importResult.errors.slice(0, 3).join(' | ')}</p>
            )}
          </div>
        ) : (
          <>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download /> Download template</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Choose CSV</Button>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={parseFile} />
        </div>
        {rows && (
          <div className="rounded-lg border">
            <p className="border-b bg-muted/40 px-3 py-2 text-sm">
              <strong>{rows.length}</strong> row(s) parsed — preview:
            </p>
            <div className="max-h-56 overflow-auto p-2 text-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    {CSV_COLUMNS.slice(0, 6).map((c) => <TableHead key={c}>{c}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((r, i) => (
                    <TableRow key={i}>
                      {CSV_COLUMNS.slice(0, 6).map((c) => <TableCell key={c}>{String(r[c]).slice(0, 22)}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        {importResult ? null : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={!rows || isLoading}>{isLoading ? 'Importing…' : `Import ${rows?.length || 0} rows`}</Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  )
}

function CredentialsDialog({ creds, onOpenChange }) {
  const [copied, setCopied] = useState('')
  function copy(text, key) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }
  return (
    <Dialog open={!!creds} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Account created</DialogTitle>
        <DialogDescription>
          Share these credentials privately with {creds?.name || 'the member'} — they sign in with them right away.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="truncate text-sm font-medium">{creds?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => copy(creds?.email || '', 'email')}>
            <Copy className="h-3.5 w-3.5" /> {copied === 'email' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
          <div>
            <p className="text-xs text-muted-foreground">One-time password</p>
            <p className="font-mono text-sm font-semibold">{creds?.password}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => copy(creds?.password || '', 'pw')}>
            <Copy className="h-3.5 w-3.5" /> {copied === 'pw' ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This password is shown only once. Ask them to keep it safe.</p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}

export default function EmployeesPage() {
  const profile = useSelector((s) => s.auth.profile)
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('active')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [terminating, setTerminating] = useState(null)
  const [creds, setCreds] = useState(null)

  const { data, isLoading, error: loadError } = useGetEmployeesQuery({ q: q || undefined, department_id: dept || undefined, status })
  const { data: deptData } = useGetDepartmentsQuery()
  const { data: desigData } = useGetDesignationsQuery()
  const [terminateEmployee, { isLoading: terminatingBusy }] = useTerminateEmployeeMutation()

  const employees = data?.employees || []
  const departments = deptData?.departments || []
  const designations = desigData?.designations || []

  function exportCsv() {
    const csv = Papa.unparse(
      employees.map((e) => ({
        employee_code: e.employee_code,
        full_name: e.full_name,
        email: e.email,
        phone: e.phone,
        department: e.departments?.name || '',
        designation: e.designations?.name || '',
        joining_date: e.joining_date,
        basic_salary: e.basic_salary,
        status: e.status,
      }))
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  async function doTerminate() {
    try {
      await terminateEmployee(terminating.id).unwrap()
      toast.success(`${terminating.full_name} marked as terminated`)
      setTerminating(null)
    } catch (err) {
      toast.error(err?.data?.error || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Employees" desc={`${employees.length} record(s)`}>
        <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}><UserPlus /> Add employee</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, code or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
          <option value="all">All</option>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : loadError ? (
          <EmptyState
            className="border-0"
            icon={AlertTriangle}
            title="Could not load employees"
            desc={loadError?.data?.error || 'Database error — if you just created the tables, make sure PATCH.sql was run in the Supabase SQL Editor.'}
          />
        ) : employees.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Users}
            title="No employees found"
            desc="Add your first employee or import a CSV file to get started."
            action={<Button onClick={() => setImportOpen(true)}><Upload /> Import CSV</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Basic salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.full_name} className="h-8 w-8 text-[11px]" />
                      <div>
                        <p className="font-medium leading-tight">{e.full_name}</p>
                        <p className="text-xs text-muted-foreground">{e.employee_code} · {e.email || 'no email'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{e.departments?.name || '—'}</TableCell>
                  <TableCell>{e.designations?.name || '—'}</TableCell>
                  <TableCell>{fmtDate(e.joining_date)}</TableCell>
                  <TableCell className="text-right font-medium">{pkr(e.basic_salary)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    {e.profile_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">● Linked</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not signed up</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { setEditing(e); setDialogOpen(true) }}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {profile?.role === 'admin' && e.status !== 'terminated' && (
                        <Button
                          variant="ghost" size="icon" title="Terminate"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setTerminating(e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {dialogOpen && (
        <EmployeeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employee={editing}
          profileId={editing?.profile_id}
          departments={departments}
          designations={designations}
          onCreated={setCreds}
        />
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CredentialsDialog creds={creds} onOpenChange={(v) => !v && setCreds(null)} />

      <Dialog open={!!terminating} onOpenChange={(v) => !v && setTerminating(null)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Terminate employee?</DialogTitle>
          <DialogDescription>
            {terminating?.full_name} will be marked as terminated and excluded from payroll. History is preserved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTerminating(null)}>Cancel</Button>
          <Button variant="destructive" onClick={doTerminate} disabled={terminatingBusy}>
            {terminatingBusy ? 'Terminating…' : 'Terminate'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
