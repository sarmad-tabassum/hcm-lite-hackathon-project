'use client'
import { useState } from 'react'
import { Search, ScrollText } from 'lucide-react'
import { useGetAuditLogsQuery } from '@/store/services/auditApi'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loading, EmptyState, PageHeader } from '@/components/ui/bits'

const ACTION_TONE = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  terminate: 'danger',
  approve: 'success',
  rejected: 'danger',
  run: 'purple',
  finalize: 'purple',
}

function toneFor(action) {
  const key = Object.keys(ACTION_TONE).find((k) => action.includes(k))
  return ACTION_TONE[key] || 'secondary'
}

export default function AuditPage() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useGetAuditLogsQuery({ q: q || undefined })
  const logs = data?.logs || []

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" desc="Last 100 tracked actions across the company" />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Filter by action (e.g. payroll, leave)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Loading />
          ) : logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No audit entries" desc="Actions like approvals, payroll runs and edits will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="font-medium">{l.profiles?.full_name || 'System'}</TableCell>
                    <TableCell><Badge variant={toneFor(l.action)}>{l.action}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{l.table_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.record_id ? l.record_id.slice(0, 8) : '—'}</TableCell>
                    <TableCell className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                      {l.new_data ? JSON.stringify(l.new_data).slice(0, 60) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
