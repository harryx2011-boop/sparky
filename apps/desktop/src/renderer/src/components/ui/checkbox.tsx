import { cn } from '@sparky/ui'
import { Check } from 'lucide-react'
import { Checkbox as C } from 'radix-ui'
import type { ComponentProps } from 'react'

export function Checkbox({ className, ...props }: ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-input bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <C.Indicator className="flex items-center justify-center">
        <Check size={12} strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  )
}
