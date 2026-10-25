import { requireRole, needCompany, bad, json } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { AI_TOOLS, runAiTool, buildSystemPrompt, toolsForRole } from '@/lib/aiTools'
import { karachiNow } from '@/lib/time'
import { throttle } from '@/lib/security'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * POST /api/ai/chat — body: { messages: [{role, content}, ...] }
 *
 * Provider chain (most → least preferred, fully automatic):
 *   1. Groq (AI_API_KEY) — real tool-calling loop. Honoured whenever the
 *      endpoint is reachable and the configured model exists.
 *      • If Groq replies 404 "model does not exist" (retired model), the call
 *        automatically retries down a small list of known Groq models.
 *      • A circuit breaker skips Groq for 10 minutes after 2 consecutive
 *        failures, so a blocked/unreachable endpoint never slows the demo.
 *   2. Platform LLM (z-ai-web-dev-sdk) — no key needed. Live data is fetched
 *      with the same role-gated tools, then phrased into a natural answer.
 *   3. Readable data summary — if even the platform LLM is down, return the
 *      live numbers as formatted text (never a dead-end, never raw JSON).
 */

const GROQ_BASE = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1'
const GROQ_URL = GROQ_BASE + '/chat/completions'

// Models that can't do chat/tool-calling are filtered out of the live list
const NON_CHAT = /whisper|guard|tts|playai|orpheus|embed/i

// Live list of models Groq currently serves (cached 1 hour)
let modelCache = { list: [], at: 0 }
async function liveModels() {
  if (modelCache.list.length && Date.now() - modelCache.at < 60 * 60 * 1000) return modelCache.list
  const res = await fetch(GROQ_BASE + '/models', {
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` },
  })
  if (!res.ok) throw new Error(`model list failed (${res.status})`)
  const data = await res.json()
  const ids = (data.data || [])
    .filter((m) => m.active !== false && !NON_CHAT.test(m.id))
    .map((m) => m.id)
  // llama / gpt-oss first (best tool-calling support)
  ids.sort((a, b) => Number(/llama|gpt-oss/i.test(b)) - Number(/llama|gpt-oss/i.test(a)))
  modelCache = { list: ids, at: Date.now() }
  return ids
}

// Tiny in-memory circuit breaker for the Groq endpoint
const breaker = { fails: 0, openUntil: 0 }
const BREAKER_THRESHOLD = 2
const BREAKER_COOLDOWN_MS = 10 * 60 * 1000
function noteGroqFailure() {
  breaker.fails += 1
  if (breaker.fails >= BREAKER_THRESHOLD) {
    breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS
    breaker.fails = 0
    console.warn('[ai/chat] Groq breaker OPEN for', BREAKER_COOLDOWN_MS / 1000, 's')
  }
}
const groqAvailable = () => Boolean(process.env.AI_API_KEY) && Date.now() > breaker.openUntil

async function callGroq(messages, tools, model) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const err = new Error(`AI provider error (${res.status}): ${t.slice(0, 200)}`)
    err.status = res.status
    err.body = t
    throw err
  }
  return res.json()
}

/** Groq call that self-heals retired models: configured model first, then live list */
async function callGroqAuto(messages, tools) {
  let candidates = [process.env.AI_MODEL].filter(Boolean)
  let lastErr = null
  for (let pass = 0; pass < 2; pass++) {
    for (const model of candidates) {
      try {
        const out = await callGroq(messages, tools, model)
        if (model !== process.env.AI_MODEL) console.warn('[ai/chat] Groq model fell back to', model)
        return out
      } catch (err) {
        lastErr = err
        const gone = err.status === 404 || /does not exist|no access|decommission|deprecat/i.test(err.body || '')
        if (!gone) throw err
        console.warn('[ai/chat] model unavailable:', model)
      }
    }
    if (pass === 0) {
      const live = await liveModels()
      candidates = live.filter((m) => m !== process.env.AI_MODEL).slice(0, 4)
      if (candidates.length === 0) break
    }
  }
  throw lastErr
}

/**
 * Platform LLM (z-ai-web-dev-sdk) — backend-only, no API key required.
 */
async function callZai(messages) {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })
  const content = completion.choices?.[0]?.message?.content
  if (!content || !String(content).trim()) throw new Error('empty response from platform LLM')
  return String(content)
}

/**
 * Degraded mode: answer from the same role-gated tools (live data), phrased
 * naturally by the platform LLM. Keyword intents pick which tools to run;
 * every role always gets at least one useful data fetch.
 */
async function fallbackAnswer(history, profile) {
  const last = (history[history.length - 1]?.content || '').toLowerCase()
  const isPrivileged = ['admin', 'hr'].includes(profile.role)
  const tryTool = async (name, args = {}) => {
    try {
      const r = await runAiTool(name, args, profile)
      return { name, r }
    } catch {
      return null
    }
  }
  const tasks = []
  const ask = (name, args = {}) => tasks.push(tryTool(name, args))
  const mentions = (...keys) => keys.some((k) => last.includes(k))
  if (isPrivileged) {
    if (mentions('headcount', 'how many employee', 'employees do we have', 'team size')) ask('get_headcount')
    if (mentions('late')) ask('get_late_comers')
    if (mentions('payroll', 'salary')) ask('get_payroll_summary')
    if (mentions('leave')) ask('get_leave_summary')
    if (mentions('attendance', 'present', 'absent')) ask('get_attendance_summary')
    if (mentions('find', 'search')) ask('search_employees', { query: last.replace(/.*(find|search)\s*/, '').slice(0, 30) })
  }
  if (mentions('leave balance', 'my leave', 'my leave balance', 'balance')) ask('get_my_leave_balance')
  if (tasks.length === 0) {
    if (isPrivileged) { ask('get_headcount'); ask('get_attendance_summary') }
    else ask('get_my_leave_balance')
  }
  const clean = (await Promise.all(tasks.slice(0, 4))).filter(Boolean)
  if (clean.length === 0) return null
  const dataJson = JSON.stringify(clean.map((c) => ({ tool: c.name, result: c.r })), null, 2)

  try {
    const reply = await callZai([
      { role: 'assistant', content: buildSystemPrompt(profile) },
      {
        role: 'assistant',
        content:
          'The primary HR analytics provider is temporarily unavailable, so answer using ONLY the live database data below (fetched moments ago for this exact user and company). Answer the user\'s latest question in their language, concisely and professionally, in PLAIN TEXT only — no markdown tables, pipes, or asterisks; use short sentences or dash lists. Never invent numbers that are not in the data; if something is missing, say so briefly.',
      },
      { role: 'assistant', content: `Live database data:\n${dataJson}` },
      ...history,
    ])
    if (reply) return reply.trim()
  } catch (err) {
    console.error('[ai/chat] fallback LLM failed:', err?.message || err)
  }

  // Last resort — readable summary, not a raw JSON dump
  const lines = clean.map((c) => `• ${c.name.replace(/_/g, ' ')}: ${summarizeTool(c.r)}`)
  return `I could not reach the language model right now, so here is your live data directly:\n\n${lines.join('\n')}\n\nPlease try again in a few minutes for a full conversational answer.`
}

/** Compact human rendering of a tool result for the last-resort message */
function summarizeTool(r) {
  if (r == null) return 'no data'
  if (typeof r === 'number') return String(r)
  if (typeof r === 'string') return r
  if (Array.isArray(r)) return `${r.length} record(s)`
  if (typeof r === 'object') {
    const parts = Object.entries(r).slice(0, 6).map(([k, v]) => {
      const label = k.replace(/_/g, ' ')
      const val = Array.isArray(v) ? `${v.length} record(s)` : typeof v === 'object' && v ? '…' : String(v)
      return `${label}: ${val}`
    })
    return parts.join(' · ')
  }
  return String(r)
}

export async function POST(req) {
  const g = await requireRole(req)
  if (g.error) return g.error
  const e = needCompany(g.profile)
  if (e) return e
  const { profile } = g

  // Cost-protection: 20 messages / 5 min / user (LLM calls are expensive)
  const flood = throttle(`ai:${profile.id}`, 20, 5 * 60 * 1000,
    'You are sending messages too quickly — please wait a moment')
  if (flood) return flood

  let body
  try { body = await req.json() } catch {}
  const history = (body?.messages || [])
    .filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-10)
  if (history.length === 0) return bad('No message provided')

  const tools = toolsForRole(profile.role)
  let reply = null
  let toolCallsCount = 0
  let provider = 'groq'
  let groqError = null

  // ── 1) Groq — real tool-calling loop (skipped when key missing or breaker open)
  if (groqAvailable()) {
    try {
      const messages = [{ role: 'system', content: buildSystemPrompt(profile) }, ...history]
      for (let round = 0; round < 3; round++) {
        const completion = await callGroqAuto(messages, tools)
        const msg = completion.choices?.[0]?.message
        if (!msg) break
        messages.push(msg)

        if (msg.tool_calls?.length) {
          for (const tc of msg.tool_calls) {
            let args = {}
            try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
            let result
            try {
              result = await runAiTool(tc.function.name, args, profile)
              toolCallsCount++
            } catch (err) {
              result = { error: err.message }
            }
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result).slice(0, 6000),
            })
          }
          continue
        }
        reply = msg.content || null
        break
      }
    } catch (err) {
      groqError = err.message
      noteGroqFailure()
      console.warn('[ai/chat] Groq failed, falling back to platform LLM:', groqError)
    }
  } else if (!process.env.AI_API_KEY) {
    provider = 'platform'
  } else {
    provider = 'platform' // breaker open — Groq temporarily skipped
  }

  // ── 2) Platform LLM degraded mode (also the path when Groq is unconfigured)
  if (!reply) {
    provider = 'platform'
    const fallbackReply = await fallbackAnswer(history, profile)
    await supabaseAdmin.from('ai_logs').insert({
      company_id: profile.company_id, user_id: profile.id, feature: 'chat',
      input_data: { messages: history.length },
      output_data: { reply: String(fallbackReply || '').slice(0, 2000) },
      status: fallbackReply ? 'fallback' : 'error',
      error_message: String(groqError || 'groq unavailable').slice(0, 500),
    })
    if (fallbackReply) return json({
      reply: fallbackReply, fallback: true, provider,
      ...(process.env.NODE_ENV !== 'production' && { debug: groqError }),
    })
    return bad(groqError || 'All AI providers failed', 502)
  }

  breaker.fails = 0
  await supabaseAdmin.from('ai_logs').insert({
    company_id: profile.company_id,
    user_id: profile.id,
    feature: 'chat',
    input_data: { messages: history.length },
    output_data: { reply: String(reply).slice(0, 2000), toolCallsCount, provider },
    status: 'success',
  })

  return json({ reply, toolCallsCount, provider, at: karachiNow().date })
}