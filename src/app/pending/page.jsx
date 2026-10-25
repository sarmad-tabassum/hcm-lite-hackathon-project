'use client'
import Link from 'next/link'
import { Hourglass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
            <Hourglass className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle>Awaiting company link</CardTitle>
          <CardDescription>
            Your account is registered, but no employee record matches your email yet. Ask your HR / admin to add
            you as an employee using <strong>exactly this email address</strong> — you will be linked automatically
            on your next login.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button variant="outline" asChild={undefined}>
            <Link href="/login">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
