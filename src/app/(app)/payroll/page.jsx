'use client'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Wallet, PlayCircle, Lock, RefreshCw, Eye, Printer } from 'lucide-react'
import { useGetPayrollQuery, useGetMyPayslipsQuery, useRunPayrollMutation, useFinalizePayrollMutation } from '@/store/services/payrollApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge, Loading, EmptyState, PageHeader } from '@/components/ui/bits'
import { pkr, MONTHS } from '@/lib/utils'

const now = new Date()

function PayslipDialog({ slip, onOpenChange }) {
  const profile = useSelector((s) => s.auth.profile)
  if (!slip) return null
  const run = slip.payroll_runs || {}
  const d = slip.details || {}
  const emp = slip.employees || {}
  const empName = emp.profiles?.full_name || profile?.full_name || '—'
  const empCode = emp.employee_code || profile?.employee_id || '—'
  const dept = emp.departments?.name || '—'
  return (
    <Dialog open onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader className="no-print">
        <DialogTitle>Payslip — {MONTHS[(run.month || 1) - 1]} {run.year}</DialogTitle>
        <DialogDescription>{d.formula || 'Gross = 1.5 × basic · slab tax'}</DialogDescription>
        <DialogClose onOpenChange={onOpenChange} />
      </DialogHeader>
      <DialogBody className="print-slip space-y-2 text-sm">
        <div className="mb-3 border-b pb-2">
          <p className="text-sm font-bold tracking-tight">{profile?.companies?.name || 'Company'}</p>
          <p className="text-xs text-muted-foreground">Salary slip for {MONTHS[(run.month || 1) - 1]} {run.year}</p>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">Employee</span><span className="font-medium">{empName}</span>
          <span className="text-muted-foreground">Employee code</span><span className="font-medium">{empCode}</span>
          <span className="text-muted-foreground">Department</span><span className="font-medium">{dept}</span>
          <span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{run.status || '—'}</span>
        </div>
        {[
          ['Basic salary', pkr(slip.basic_salary)],
          ['Allowances (50%)', pkr(slip.allowances)],
          ['Gross (1.5 × basic)', pkr(slip.gross)],
          ['Tax (slab / 12)', '− ' + pkr(slip.tax)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b pb-1.5">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
        <div className="flex justify-between pt-1 text-base">
          <span className="font-semibold">Net pay</span>
          <span className="font-bold text-primary">{pkr(slip.net)}</span>
        </div>
        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Present days: {d.present_days ?? '—'} · Late: {d.late_days ?? 0} · Half days: {d.half_days ?? 0} · Paid leave: {d.leave_days ?? 0}
        </div>
        <div className="mt-6 hidden justify-between pt-8 text-[10px] text-muted-foreground print:flex">
          <span>Employee signature</span>
          <span>Authorized signature</span>
        </div>
      </DialogBody>
      <DialogFooter className="no-print">
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogFooter>
    </Dialog>
  )
}

function AdminPayroll() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { data, isLoading, isFetching } = useGetPayrollQuery({ month, year })
  const [runPayroll, { isLoading: running }] = useRunPayrollMutation()
  const [finalizePayroll, { isLoading: finalizing }] = useFinalizePayrollMutation()
  const [slip, setSlip] = useState(null)

  const run = data?.run
  const slips = data?.slips || []
  const totals = data?.totals

  async function doRun() {
    try {
      const res = await runPayroll({ month, year }).unwrap()
      toast.success(`Payroll recalculated for ${res.employees} employee(s)`)
    } catch (err) {
      toast.error(err?.data?.error || 'Run failed')
    }
  }
  async function doFinalize() {
    try {
      await finalizePayroll(run.id).unwrap()
      toast.success('Payroll finalized and locked')
    } catch (err) {
      toast.error(err?.data?.error || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Payroll run</CardTitle>
            <CardDescription>Gross = 1.5 × basic · annual slab tax ÷ 12</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <Label className="sr-only">Month</Label>
              <Select className="w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="sr-only">Year</Label>
              <Select className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
            {run ? (
              <Button variant="outline" onClick={doRun} disabled={running || run.status === 'finalized'}>
                <RefreshCw /> {running ? 'Running…' : 'Re-run'}
              </Button>
            ) : (
              <Button onClick={doRun} disabled={running}>
                <PlayCircle /> {running ? 'Running…' : 'Run payroll'}
              </Button>
            )}
            {run?.status === 'draft' && (
              <Button variant="success" onClick={doFinalize} disabled={finalizing}>
                <Lock /> {finalizing ? 'Locking…' : 'Finalize'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {run && (
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">
                {MONTHS[run.month - 1]} {run.year} · {totals?.count || 0} payslip(s)
              </span>
            </div>
          )}
          {isLoading || isFetching ? (
            <Loading />
          ) : !run ? (
            <EmptyState
              icon={Wallet}
              title={`No payroll for ${MONTHS[month - 1]} ${year}`}
              desc="Run payroll to generate payslips for all active employees who joined before month-end. Re-running a draft recalculates it; finalize locks it."
              action={<Button onClick={doRun} disabled={running}><PlayCircle /> Run payroll</Button>}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium leading-tight">{s.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.employees?.employee_code}</p>
                    </TableCell>
                    <TableCell>{s.employees?.departments?.name || '—'}</TableCell>
                    <TableCell className="text-right">{pkr(s.basic_salary)}</TableCell>
                    <TableCell className="text-right">{pkr(s.allowances)}</TableCell>
                    <TableCell className="text-right font-medium">{pkr(s.gross)}</TableCell>
                    <TableCell className="text-right text-red-600">− {pkr(s.tax)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{pkr(s.net)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSlip(s)} title="View payslip">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {run && totals && (
            <div className="flex flex-wrap justify-end gap-6 rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <span>Gross: <strong>{pkr(totals.gross)}</strong></span>
              <span>Tax: <strong className="text-red-600">{pkr(totals.tax)}</strong></span>
              <span>Net: <strong className="text-primary">{pkr(totals.net)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>
      {slip && <PayslipDialog slip={slip} onOpenChange={() => setSlip(null)} />}
    </div>
  )
}

function MyPayslips() {
  const { data, isLoading } = useGetMyPayslipsQuery()
  const [slip, setSlip] = useState(null)
  const slips = data?.slips || []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>My payslips</CardTitle>
          <CardDescription>Published payroll history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loading />
          ) : slips.length === 0 ? (
            <EmptyState icon={Wallet} title="No payslips yet" desc="They will appear here after your company runs payroll." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{MONTHS[(s.payroll_runs?.month || 1) - 1]} {s.payroll_runs?.year}</TableCell>
                    <TableCell className="text-right">{pkr(s.gross)}</TableCell>
                    <TableCell className="text-right text-red-600">− {pkr(s.tax)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{pkr(s.net)}</TableCell>
                    <TableCell><StatusBadge status={s.payroll_runs?.status || 'draft'} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSlip(s)} title="View payslip">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {slip && <PayslipDialog slip={slip} onOpenChange={() => setSlip(null)} />}
    </div>
  )
}

export default function PayrollPage() {
  const profile = useSelector((s) => s.auth.profile)
  const isPrivileged = ['admin', 'hr'].includes(profile?.role)
  return (
    <div className="space-y-4">
      <PageHeader title="Payroll" desc={isPrivileged ? 'Run, review and finalize monthly payroll' : 'Your salary slips'} />
      {isPrivileged ? <AdminPayroll /> : <MyPayslips />}
    </div>
  )
}
