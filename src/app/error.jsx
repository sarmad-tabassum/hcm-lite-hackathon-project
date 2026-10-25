'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCcw, Home, BugOff } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/**
 * Route-level crash guard — if any page throws while rendering, the user
 * gets a friendly recovery screen (with their session intact) instead of a
 * white screen / raw error. Production details go to the console only.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-500/15">
            <BugOff className="h-7 w-7 text-rose-600 dark:text-rose-400" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            The page hit an unexpected error and stopped rendering. Your data is safe —
            try again, or head back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset}>
            <RefreshCcw className="h-4 w-4" /> Try again
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
            <Home className="h-4 w-4" /> Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
