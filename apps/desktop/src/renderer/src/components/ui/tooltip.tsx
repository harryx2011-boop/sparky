import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-50 max-w-72 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
