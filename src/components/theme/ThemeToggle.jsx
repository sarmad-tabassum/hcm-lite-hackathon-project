'use client'
import { useSyncExternalStore } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { cn } from '@/lib/utils'

const emptySubscribe = () => () => {}
// Hydration-safe "mounted" flag: false on the server render, true afterwards.
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

/**
 * Segmented light / dark / system switcher with a sliding indicator.
 * Compact enough for the app topbar, and reused (floating) on auth pages.
 */
export default function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const options = [
    { key: 'light', icon: Sun, label: 'Light' },
    { key: 'dark', icon: Moon, label: 'Dark' },
    { key: 'system', icon: Monitor, label: 'System' },
  ]
  const activeIndex = mounted ? Math.max(0, options.findIndex((o) => o.key === theme)) : 2

  function pick(key) {
    if (key === theme) return
    // brief cross-fade of the whole UI instead of a hard snap
    const root = document.documentElement
    root.classList.add('theme-anim')
    setTimeout(() => root.classList.remove('theme-anim'), 400)
    setTheme(key)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        'relative inline-flex h-8 items-center gap-0.5 rounded-full border bg-muted/60 p-0.5 backdrop-blur',
        className
      )}
    >
      {/* sliding pill */}
      <span
        aria-hidden
        className="absolute top-0.5 h-7 w-7 rounded-full bg-background shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 28}px)`, left: 2 }}
      />
      {options.map((o) => {
        const Icon = o.icon
        const active = mounted && theme === o.key
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={active}
            aria-label={`${o.label} theme`}
            title={`${o.label} theme`}
            onClick={() => pick(o.key)}
            className={cn(
              'relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
