'use client'
import { cn } from '@/lib/utils'

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            value === t.value
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
