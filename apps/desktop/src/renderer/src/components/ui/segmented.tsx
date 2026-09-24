import { cn } from '@sparky/ui'
import { ToggleGroup } from 'radix-ui'
import type { ReactNode } from 'react'

/** A compact single-choice toggle group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  className?: string
  label: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex h-8 items-center rounded-lg border border-input bg-card p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className="inline-flex h-full grow items-center justify-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-secondary data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
