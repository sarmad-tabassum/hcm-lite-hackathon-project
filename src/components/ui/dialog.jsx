'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onOpenChange, children, className }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onOpenChange?.(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onOpenChange])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => onOpenChange?.(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-lg rounded-xl border bg-card text-card-foreground shadow-xl max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 border-b p-5', className)} {...props} />
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-semibold', className)} {...props} />
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function DialogBody({ className, ...props }) {
  return <div className={cn('space-y-4 p-5', className)} {...props} />
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end', className)} {...props} />
}

export function DialogClose({ onOpenChange }) {
  return (
    <button
      onClick={() => onOpenChange?.(false)}
      className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>
  )
}
