'use client'
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'

/**
 * Theme system — light / dark / system, persisted per browser.
 *
 * Flicker-free: an inline script in the root <html> applies the saved theme
 * BEFORE React hydrates (see src/app/layout.jsx). This provider then takes
 * over: it reads the preference through useSyncExternalStore (hydration-safe,
 * no effect/setState cascades), re-asserts the DOM class and follows the OS
 * preference while mode = "system".
 *
 * Public API:  const { theme, resolvedTheme, setTheme } = useTheme()
 *   theme          → 'light' | 'dark' | 'system'   (what the user picked)
 *   resolvedTheme  → 'light' | 'dark'              (what is actually on screen)
 */

const STORAGE_KEY = 'hcm-theme'
const VALID = ['light', 'dark', 'system']
const ThemeContext = createContext({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} })

/* ── tiny external store (module-level, survives re-mounts) ─────────── */
let prefCache = null
const listeners = new Set()

function readPref() {
  if (typeof window === 'undefined') return 'system'
  if (prefCache) return prefCache
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    prefCache = VALID.includes(stored) ? stored : 'system'
  } catch {
    prefCache = 'system'
  }
  return prefCache
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return readPref()
}

function getServerSnapshot() {
  return 'system'
}

/* ── OS dark-preference as its own external store ───────────────────── */
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const mqListeners = new Set()

if (mq) {
  mq.addEventListener('change', () => mqListeners.forEach((l) => l()))
}

function mqSubscribe(cb) {
  if (!mq) return () => {}
  mqListeners.add(cb)
  return () => mqListeners.delete(cb)
}
const mqSnapshot = () => (mq ? mq.matches : false)
const mqServerSnapshot = () => false

/* ── DOM application ────────────────────────────────────────────────── */
function applyToDom(resolved) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  root.dataset.theme = resolved
}

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const sysDark = useSyncExternalStore(mqSubscribe, mqSnapshot, mqServerSnapshot)
  const resolvedTheme = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme

  // Keep <html> in sync (external-system update only — no state cascade)
  useEffect(() => {
    applyToDom(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = (next) => {
    const value = VALID.includes(next) ? next : 'system'
    prefCache = value
    try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* private mode */ }
    applyToDom(value === 'system' ? (mq?.matches ? 'dark' : 'light') : value)
    listeners.forEach((l) => l())
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
