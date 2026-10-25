'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserRound, KeyRound, LogOut, ShieldCheck, Ticket, Copy, Info } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { supabase } from '@/lib/supabaseClient'
import { useUpdateProfileMutation, useGetJoinCodesQuery } from '@/store/services/authApi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/bits'
import { clearAuth } from '@/store/features/authSlice'
import { api } from '@/store/apiBase'

export default function SettingsPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const profile = useSelector((s) => s.auth.profile)
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation()
  const isAdmin = profile?.role === 'admin'
  const { data: codes } = useGetJoinCodesQuery(undefined, { skip: !isAdmin })

  function copyCode(code) {
    navigator.clipboard?.writeText(code)
    toast.success(`Copied ${code}`)
  }

  const [name, setName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [changing, setChanging] = useState(false)

  // Client-side mirror of the server password policy (new accounts & changes)
  function pwProblem(v) {
    if (v.length < 8) return 'Password must be at least 8 characters'
    if (!/[a-z]/.test(v) || !/[A-Z]/.test(v) || !/[0-9]/.test(v))
      return 'Password needs an uppercase letter, a lowercase letter and a number'
    return null
  }

  async function saveProfile(e) {
    e.preventDefault()
    try {
      await updateProfile({ full_name: name, phone }).unwrap()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err?.data?.error || 'Could not update profile')
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    const problem = pwProblem(pw.next)
    if (problem) return toast.error(problem)
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match')
    setChanging(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw.next })
      if (error) throw error
      toast.success('Password changed — use it on your next sign-in')
      setPw({ next: '', confirm: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setChanging(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    dispatch(clearAuth())
    api.util.resetApiState()
    router.replace('/login')
  }

  const roleLabel = { admin: 'Admin', hr: 'HR', employee: 'Employee' }[profile?.role] || profile?.role

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        icon={UserRound}
        title="Settings"
        desc="Manage your personal profile, password and session."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" /> Profile</CardTitle>
          <CardDescription>{profile?.email} · {roleLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
            </Field>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && codes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4" /> Team join codes</CardTitle>
            <CardDescription>
              Share these so people can create their own accounts on the right portal.
              HR staff sign up at <b>/signup/hr</b>, employees at <b>/signup/employee</b>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Admin join code', code: codes.admin_code, tone: 'text-emerald-600 dark:text-emerald-400', danger: true },
              { label: 'HR join code', code: codes.hr_code, tone: 'text-sky-600 dark:text-sky-400' },
              { label: 'Employee join code', code: codes.employee_code, tone: 'text-violet-600 dark:text-violet-400' },
            ].map((row) => (
              <div key={row.label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${row.danger ? 'border-amber-500/40 bg-amber-500/5' : 'bg-muted/30'}`}>
                <div>
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className={`font-mono text-sm font-semibold tracking-wider ${row.tone}`}>{row.code}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyCode(row.code)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
              </div>
            ))}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              HR &amp; employee codes let people sign up for that role — their accounts still wait for
              your approval on the dashboard before they can access anything.
            </p>
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The ADMIN code grants full admin of THIS company to whoever holds it. Share it only
              with a co-admin you trust — never post it in group chats.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Change password</CardTitle>
          <CardDescription>At least 8 characters with upper &amp; lower case letters and a number. You stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="New password">
              <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="••••••••" required />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="••••••••" required />
            </Field>
            <Button type="submit" variant="outline" disabled={changing}>{changing ? 'Updating…' : 'Update password'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Session</CardTitle>
          <CardDescription>Sign out of this device. Your data stays private to your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </CardContent>
      </Card>
    </div>
  )
}
