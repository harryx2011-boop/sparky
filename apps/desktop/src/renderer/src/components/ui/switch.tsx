import { cn } from '@sparky/ui'
import { Switch as S } from 'radix-ui'
import type { ComponentProps } from 'react'

export function Switch({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        'peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-lime',
        className,
      )}
      {...props}
    >
      <S.Thumb className="pointer-events-none block size-3.5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-0.5" />
    </S.Root>
  )
}
