'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, MapPin, Loader2, Building2, Network, BadgeCheck, CalendarDays, Palmtree, ShieldCheck } from 'lucide-react'
import {
  useGetCompanyQuery, useUpdateCompanyMutation,
  useGetDepartmentsQuery, useSaveDepartmentMutation, useDeleteDepartmentMutation,
  useGetDesignationsQuery, useSaveDesignationMutation, useDeleteDesignationMutation,
  useGetLeaveTypesQuery, useSaveLeaveTypeMutation, useDeleteLeaveTypeMutation,
  useGetHolidaysQuery, useSaveHolidayMutation, useDeleteHolidayMutation,
  useGetProfilesQuery, useUpdateRoleMutation,
} from '@/store/services/orgApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Loading, PageHeader } from '@/components/ui/bits'
import { Badge } from '@/components/ui/badge'
import { fmtDate } from '@/lib/utils'

// ---------- generic CRUD section ----------
function CrudSection({ title, desc, icon: Icon, dataKey, columns, fields, lister, saveHook, deleteHook, entityName }) {
  const { data: listRaw, isLoading } = lister()
  const list = listRaw?.[dataKey] || []
  const [save, { isLoading: saving }] = saveHook()
  const [remove] = deleteHook()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [confirmId, setConfirmId] = useState(null)

  function startAdd() {
    setEditing(null)
    setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? '' }), {}))
    setOpen(true)
  }
  function startEdit(row) {
    setEditing(row)
    setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: row[f.key] ?? '' }), {}))
    setOpen(true)
  }
  async function doSave() {
    try {
      await save({ id: editing?.id, ...form }).unwrap()
      toast.success(`${entityName} ${editing ? 'updated' : 'added'}`)
      setOpen(false)
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed')
    }
  }
  async function doDelete() {
    try {
      await remove(confirmId).unwrap()
      toast.success(`${entityName} deleted`)
      setConfirmId(null)
    } catch (err) {
      toast.error(err?.data?.error || 'Delete failed')
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">{Icon && <Icon className="h-4 w-4 text-primary" />} {title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
        <Button size="sm" onClick={startAdd}><Plus /> Add</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loading />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet — add the first one.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{c.render ? c.render(row) : row[c.key]}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(row)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setConfirmId(row.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${entityName.toLowerCase()}` : `Add ${entityName.toLowerCase()}`}</DialogTitle>
          <DialogClose onOpenChange={setOpen} />
        </DialogHeader>
        <DialogBody>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'select' ? (
                <Select value={String(form[f.key] ?? '')} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : (
                <Input
                  type={f.type || 'text'}
                  value={form[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!confirmId} onOpenChange={(v) => !v && setConfirmId(null)} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {entityName.toLowerCase()}?</DialogTitle>
          <DialogDescription>This cannot be undone. Records referencing it keep working (FK set to null).</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
          <Button variant="destructive" onClick={doDelete}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}

// ---------- company settings ----------
function CompanyTab() {
  const { data } = useGetCompanyQuery()
  const [updateCompany, { isLoading }] = useUpdateCompanyMutation()
  const [locating, setLocating] = useState(false)
  const c = data?.company
  const [form, setForm] = useState(null)
  const model = form || {
    name: c?.name || '',
    office_start: (c?.office_start || '09:00').slice(0, 5),
    office_end: (c?.office_end || '17:00').slice(0, 5),
    latitude: c?.latitude ?? '',
    longitude: c?.longitude ?? '',
    radius: c?.radius || 100,
  }
  const set = (k) => (e) => setForm({ ...model, [k]: e.target.value })

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Geolocation not supported')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...model, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })
        setLocating(false)
      },
      () => { setLocating(false); toast.error('Could not get location') }
    )
  }

  async function save() {
    try {
      await updateCompany({
        name: model.name,
        office_start: model.office_start,
        office_end: model.office_end,
        latitude: model.latitude === '' ? null : Number(model.latitude),
        longitude: model.longitude === '' ? null : Number(model.longitude),
        radius: Number(model.radius) || 100,
      }).unwrap()
      toast.success('Company settings saved')
    } catch (err) {
      toast.error(err?.data?.error || 'Save failed')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company settings</CardTitle>
        <CardDescription>Office hours drive the late rule (after start + 15 min). Location enables geo-fenced check-in.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name"><Input value={model.name} onChange={set('name')} /></Field>
          <Field label="Radius (meters)"><Input type="number" min="20" value={model.radius} onChange={set('radius')} /></Field>
          <Field label="Office start"><Input type="time" value={model.office_start} onChange={set('office_start')} /></Field>
          <Field label="Office end"><Input type="time" value={model.office_end} onChange={set('office_end')} /></Field>
          <Field label="Latitude"><Input value={model.latitude} onChange={set('latitude')} placeholder="24.8607" /></Field>
          <Field label="Longitude"><Input value={model.longitude} onChange={set('longitude')} placeholder="67.0011" /></Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin />} Use my location
          </Button>
          <Button onClick={save} disabled={isLoading}>{isLoading ? 'Saving…' : 'Save settings'}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- roles ----------
function RolesTab() {
  const { data } = useGetProfilesQuery()
  const [updateRole] = useUpdateRoleMutation()
  const profiles = data?.profiles || []

  async function changeRole(p, role) {
    try {
      await updateRole({ id: p.id, role }).unwrap()
      toast.success(`${p.full_name} is now ${role}`)
    } catch (err) {
      toast.error(err?.data?.error || 'Failed')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Roles & access</CardTitle>
        <CardDescription>Admin manages everything · HR manages employees, attendance, leave & payroll · Employees are self-service.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Linked code</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>{p.employee_id || '—'}</TableCell>
                <TableCell>
                  <Select className="w-32" value={p.role} disabled={p.is_self} onChange={(e) => changeRole(p, e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="hr">HR</option>
                    <option value="employee">Employee</option>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function OrgPage() {
  const [tab, setTab] = useState('company')

  return (
    <div className="space-y-4">
      <PageHeader title="Organization" desc="Company, structure, leave policy, holidays and roles" />
      <Tabs
        tabs={[
          { value: 'company', label: 'Company' },
          { value: 'departments', label: 'Departments' },
          { value: 'designations', label: 'Designations' },
          { value: 'leavetypes', label: 'Leave types' },
          { value: 'holidays', label: 'Holidays' },
          { value: 'roles', label: 'Roles' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'company' && <CompanyTab />}

      {tab === 'departments' && (
        <CrudSection
          title="Departments" desc="Teams in your company" icon={Network} entityName="Department"
          dataKey="departments" lister={useGetDepartmentsQuery}
          saveHook={useSaveDepartmentMutation} deleteHook={useDeleteDepartmentMutation}
          fields={[{ key: 'name', label: 'Name', placeholder: 'Engineering' }, { key: 'description', label: 'Description (optional)' }]}
          columns={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]}
        />
      )}

      {tab === 'designations' && (
        <CrudSection
          title="Designations" desc="Job titles" icon={BadgeCheck} entityName="Designation"
          dataKey="designations" lister={useGetDesignationsQuery}
          saveHook={useSaveDesignationMutation} deleteHook={useDeleteDesignationMutation}
          fields={[{ key: 'name', label: 'Name', placeholder: 'Software Engineer' }, { key: 'description', label: 'Description (optional)' }]}
          columns={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]}
        />
      )}

      {tab === 'leavetypes' && (
        <CrudSection
          title="Leave types" desc="Annual quota per type — drives leave validation" icon={Palmtree} entityName="Leave type"
          dataKey="leaveTypes" lister={useGetLeaveTypesQuery}
          saveHook={useSaveLeaveTypeMutation} deleteHook={useDeleteLeaveTypeMutation}
          fields={[
            { key: 'name', label: 'Name', placeholder: 'Annual Leave' },
            { key: 'days_allowed', label: 'Annual quota (days)', type: 'number', default: 0 },
          ]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'days_allowed', label: 'Quota/yr' },
            { key: 'is_paid', label: 'Paid', render: (r) => <Badge variant={r.is_paid ? 'success' : 'muted'}>{r.is_paid ? 'Paid' : 'Unpaid'}</Badge> },
          ]}
        />
      )}

      {tab === 'holidays' && (
        <CrudSection
          title="Holidays" desc="Excluded from attendance and leave day counts" icon={CalendarDays} entityName="Holiday"
          dataKey="holidays" lister={useGetHolidaysQuery}
          saveHook={useSaveHolidayMutation} deleteHook={useDeleteHolidayMutation}
          fields={[
            { key: 'name', label: 'Name', placeholder: 'Independence Day' },
            { key: 'holiday_date', label: 'Date', type: 'date' },
          ]}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'holiday_date', label: 'Date', render: (r) => fmtDate(r.holiday_date) },
          ]}
        />
      )}

      {tab === 'roles' && <RolesTab />}
    </div>
  )
}
