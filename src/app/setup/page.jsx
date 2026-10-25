'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, MapPin, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useCreateCompanyMutation } from '@/store/services/orgApi'
import { Button } from '@/components/ui/button'
import { Input, Field, Label } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupPage() {
  const router = useRouter()
  const [createCompany, { isLoading }] = useCreateCompanyMutation()
  const [form, setForm] = useState({ name: '', office_start: '09:00', office_end: '17:00', latitude: '', longitude: '', radius: 100 })
  const [locating, setLocating] = useState(false)
  const [sessionEmail, setSessionEmail] = useState(null)

  // Session guard — a stale/dead browser session used to sit on this form and
  // fail with "Not authenticated" on submit. Detect it up-front instead.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        toast.error('Your session has expired — please sign in again')
        router.replace('/login')
        return
      }
      setSessionEmail(session.user.email)
      // Already created a company? Then there is nothing to set up.
      try {
        const res = await supabase.from('profiles').select('company_id').eq('id', session.user.id).maybeSingle()
        if (res.data?.company_id) router.replace('/dashboard')
      } catch {}
    })
  }, [router])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by your browser')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setLocating(false)
        toast.success('Office location captured')
      },
      () => {
        setLocating(false)
        toast.error('Could not get your location — you can fill it manually or skip')
      }
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    try {
      await createCompany({
        name: form.name,
        office_start: form.office_start,
        office_end: form.office_end,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        radius: Number(form.radius) || 100,
      }).unwrap()
      toast.success('Company created — welcome aboard!')
      router.replace('/dashboard')
    } catch (err) {
      const msg = err?.data?.error || err.message
      toast.error(msg)
      // Dead/expired session → sign out cleanly so the user can sign in again
      if (err?.status === 401 || msg === 'Not authenticated' || msg === 'Invalid session') {
        await supabase.auth.signOut()
        router.replace('/login')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/60 to-background p-6 dark:from-emerald-950/30">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Set up your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">First-run setup — this makes you the Admin</p>
          {sessionEmail && (
            <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                Signed in as <span className="font-medium text-foreground">{sessionEmail}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.replace('/login')
                }}
                className="ml-1 font-medium text-primary hover:underline"
              >
                Switch account
              </button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>You can change all of this later under Organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Company name">
                <Input required placeholder="Saylani Technologies (Pvt) Ltd" value={form.name} onChange={set('name')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Office start">
                  <Input type="time" value={form.office_start} onChange={set('office_start')} />
                </Field>
                <Field label="Office end">
                  <Input type="time" value={form.office_end} onChange={set('office_end')} />
                </Field>
              </div>
              <Field label="Office location (optional)" hint="Enables geo-fenced check-in within the given radius">
                <Button type="button" variant="outline" className="w-full" onClick={useMyLocation} disabled={locating}>
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  {locating ? 'Locating…' : 'Use my current location'}
                </Button>
              </Field>
              {form.latitude && (
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Latitude">
                    <Input value={form.latitude} onChange={set('latitude')} />
                  </Field>
                  <Field label="Longitude">
                    <Input value={form.longitude} onChange={set('longitude')} />
                  </Field>
                  <Field label="Radius (m)">
                    <Input type="number" min="20" value={form.radius} onChange={set('radius')} />
                  </Field>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating…' : 'Create company & continue'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Next: add departments & leave types → import employees → your team can sign up and auto-link by email
        </p>
      </div>
    </div>
  )
}
