import type { Resolution, ResolutionOption } from '@sparky/core'
import { Tooltip } from 'radix-ui'
import { cn } from './cn'

export interface ResolutionPickerProps {
  options: ResolutionOption[]
  /** null means "same as the source". */
  value: Resolution | null
  onChange: (value: Resolution | null) => void
  /** Adds an "Original" choice that keeps the source size. */
  allowOriginal?: boolean
  originalLabel?: string
  className?: string
  size?: 'sm' | 'md'
}

/** 720p · 1080p · 1440p · 4K. Locked options explain why in a tooltip. */
export function ResolutionPicker({ options, value, onChange, allowOriginal = true, originalLabel = 'Original', className, size = 'sm' }: ResolutionPickerProps) {
  const visible = options.filter((o) => !o.hidden)
  const btn = cn(
    'inline-flex items-center justify-center rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-sm',
  )
  const idle = 'border-input bg-card text-foreground hover:bg-accent'
  const selected = 'border-primary bg-primary text-primary-foreground'
  return (
    <Tooltip.Provider delayDuration={150}>
      <div role="radiogroup" aria-label="Resolution" className={cn('flex flex-wrap gap-2', className)}>
        {allowOriginal && (
          <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={cn(btn, value === null ? selected : idle)}>
            {originalLabel}
          </button>
        )}
        {visible.map((o) => {
          const button = (
            <button
              type="button"
              role="radio"
              aria-checked={value === o.value}
              aria-disabled={o.locked || undefined}
              onClick={() => !o.locked && onChange(o.value)}
              className={cn(btn, o.locked ? 'cursor-not-allowed border-input bg-card text-foreground opacity-40' : value === o.value ? selected : idle)}
            >
              {o.label}
            </button>
          )
          if (!o.locked || !o.reason) return <span key={o.value}>{button}</span>
          return (
            <Tooltip.Root key={o.value}>
              <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="top"
                  sideOffset={6}
                  className="z-50 max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
                >
                  {o.reason}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )
        })}
      </div>
    </Tooltip.Provider>
  )
}
