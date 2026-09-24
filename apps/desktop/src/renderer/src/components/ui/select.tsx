import { cn } from '@sparky/ui'
import { Check, ChevronDown } from 'lucide-react'
import { Select as S } from 'radix-ui'
import type { ReactNode } from 'react'

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  label: string
}) {
  return (
    <S.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <S.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <S.Value />
        <S.Icon>
          <ChevronDown size={14} className="text-subtle-foreground" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex h-8 cursor-default select-none items-center rounded-md pl-7 pr-2 text-[13px] outline-none data-[highlighted]:bg-accent"
              >
                <S.ItemIndicator className="absolute left-2">
                  <Check size={13} />
                </S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
