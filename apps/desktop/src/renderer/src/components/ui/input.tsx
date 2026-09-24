import { cn } from '@sparky/ui'
import type { ComponentProps } from 'react'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-[11px] font-medium text-subtle-foreground', className)} {...props} />
}
