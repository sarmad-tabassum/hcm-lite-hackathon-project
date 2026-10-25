'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function Dropdown({ trigger, children, align = 'end', width = 'w-64' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg',
            width,
            align === 'end' ? 'right-0' : 'left-0'
          )}
          onClick={() => setTimeout(() => setOpen(false), 150)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({ className, ...props }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent cursor-pointer',
        className
      )}
      {...props}
    />
  )
}

export function DropdownLabel({ className, ...props }) {
  return <div className={cn('px-2.5 py-1.5 text-xs font-medium text-muted-foreground', className)} {...props} />
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-border" />
}
