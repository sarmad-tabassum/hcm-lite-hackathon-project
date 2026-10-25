import { NextResponse } from 'next/server'

/**
 * Shared security utilities — rate limiting, input hardening, password policy.
 *
 * All helpers are server-only (imported exclusively from /api routes).
 * The rate limiter is an in-memory sliding window: right-sized for a single
 * instance / hackathon deployment, zero infrastructure required.
 */

/* ──────────────────────────── Client IP ──────────────────────────── */

export function clientIp(req) {
  const fwd = req?.headers?.get('x-forwarded-for')
  if (fwd) {
    const first = String(fwd).split(',')[0].trim()
    if (first) return first.slice(0, 64)
  }
  return req?.headers?.get('x-real-ip')?.slice(0, 64) || 'local'
}

/* ─────────────────────── Sliding-window limiter ─────────────────────── */

const BUCKETS = new Map() // key → number[] (timestamps)
let lastSweep = 0

/** Periodically drop empty/stale buckets so the Map cannot grow forever. */
function sweep(now, windowMs) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, hits] of BUCKETS) {
    const alive = hits.filter((t) => now - t < windowMs)
    if (alive.length === 0) BUCKETS.delete(key)
    else BUCKETS.set(key, alive)
  }
}

/**
 * Consume one hit for `key`. Returns false when the caller is over quota.
 * `windowMs` sliding window, `max` hits allowed per window.
 */
export function rateLimit(key, max, windowMs) {
  const now = Date.now()
  sweep(now, windowMs)
  const hits = (BUCKETS.get(key) || []).filter((t) => now - t < windowMs)
  hits.push(now)
  BUCKETS.set(key, hits)
  return hits.length <= max
}

/** Reads remaining quota without consuming a hit. */
export function rateLimitRemaining(key, max, windowMs) {
  const now = Date.now()
  const hits = (BUCKETS.get(key) || []).filter((t) => now - t < windowMs)
  return Math.max(0, max - hits.length)
}

/**
 * Throttle helper for route handlers.
 * Returns a 429 NextResponse when over quota, otherwise null (continue).
 */
export function throttle(key, max, windowMs, message = 'Too many requests — please slow down and try again shortly') {
  if (rateLimit(key, max, windowMs)) return null
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
  )
}

/* ───────────────────────── Input hardening ───────────────────────── */

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

/** Strip control characters, collapse whitespace, hard-cap length. */
export function sanitizeText(value, maxLen = 120) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return UUID_RE.test(String(value || ''))
}

/** Join codes: uppercase alphanumerics + dashes, short. */
export function normalizeJoinCode(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24)
}

/* ────────────────────────── Password policy ────────────────────────── */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '1234567', '12345678',
  '123456789', '1234567890', 'qwerty', 'qwerty123', 'abc123', 'abc12345',
  'iloveyou', 'admin123', 'admin@123', 'letmein', 'welcome1', 'welcome123',
  'monkey123', 'dragon123', 'sunshine', 'princess', 'football', 'baseball',
  'pakistan', 'pakistan1', 'saylani', 'saylani123', 'hcm123', 'hcm@123',
  'aaaaaaaa', '11111111', '00000000', 'q1w2e3r4', '1q2w3e4r',
])

/**
 * Professional baseline for NEW accounts: ≥8 chars, mixed case + digit,
 * not a well-known password, ≤72 bytes (bcrypt limit).
 * Returns null when acceptable, otherwise a human-readable reason.
 */
export function passwordProblem(pw) {
  const s = String(pw ?? '')
  if (s.length < 8) return 'Password must be at least 8 characters'
  if (s.length > 72) return 'Password must be at most 72 characters'
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/[0-9]/.test(s))
    return 'Password needs an uppercase letter, a lowercase letter and a number'
  if (COMMON_PASSWORDS.has(s.toLowerCase())) return 'This password is too common — please choose a stronger one'
  return null
}

/* ────────────────────────── Body-size guard ────────────────────────── */

/** Reject oversized JSON bodies before parsing (DoS guard). */
export async function readJson(req, maxBytes = 16 * 1024) {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > maxBytes) return { error: 'Request body too large', status: 413 }
  try {
    return { body: await req.json() }
  } catch {
    return { error: 'Invalid request body', status: 400 }
  }
}
