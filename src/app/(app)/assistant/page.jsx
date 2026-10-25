'use client'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { useChatAiMutation } from '@/store/services/aiApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/bits'
import { cn } from '@/lib/utils'

const SUGGESTIONS = {
  privileged: [
    "What's today's attendance summary?",
    'Who was late today?',
    'How many employees do we have?',
    'Show payroll summary for this month',
    "What's the leave summary for this month?",
  ],
  employee: [
    "What's my leave balance?",
    'Explain the late and half-day policy',
    'How is my salary tax calculated?',
  ],
}

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2.5', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm border bg-card'
        )}
      >
        {content}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const profile = useSelector((s) => s.auth.profile)
  const isPrivileged = ['admin', 'hr'].includes(profile?.role)
  const [chatAi, { isLoading }] = useChatAiMutation()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! I'm your HCM assistant. Ask me about attendance, leave, payroll or employees — I answer from live company data.`,
    },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || isLoading) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    try {
      const res = await chatAi({ messages: next.filter((m) => m.role !== 'error').slice(-10) }).unwrap()
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch (err) {
      const msg = err?.data?.error || 'The assistant is unavailable right now.'
      toast.error(msg)
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${msg}` }])
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-3xl flex-col space-y-4">
      <PageHeader title="AI Assistant" desc="Tool-calling on live HR data · Llama 3.3 · automatic provider failover" />

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Sparkles className="h-4 w-4" />
            </span>
            HCM Assistant
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {isPrivileged ? 'Full data access' : 'Self-service access'}
            </span>
          </CardTitle>
          <CardDescription className="sr-only">AI assistant chat</CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4" ref={scrollRef}>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4 animate-pulse" /> thinking…
            </div>
          )}
        </CardContent>

        <div className="border-t p-3">
          {messages.length <= 1 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {(isPrivileged ? SUGGESTIONS.privileged : SUGGESTIONS.employee).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <Input
              placeholder="Ask anything about your HR data…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
