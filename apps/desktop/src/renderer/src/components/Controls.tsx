import { PERFORMANCE_LEVELS, type PerformanceLevel } from '@sparky/core'
import { cn, PerformanceBars } from '@sparky/ui'
import type { ReactNode } from 'react'
import { Label } from './ui/input'
import { Tip } from './ui/tooltip'

export function Field({ label, children, className, hint }: { label: ReactNode; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="truncate font-mono text-[11px] text-subtle-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/** Low / Normal / Max with the animated bars. */
export function PerformancePicker({ value, onChange, running, note }: { value: PerformanceLevel; onChange: (v: PerformanceLevel) => void; running?: boolean; note?: string }) {
  return (
    <div role="radiogroup" aria-label="Performance" className="flex h-8 items-stretch rounded-lg border border-input bg-card p-0.5">
      {PERFORMANCE_LEVELS.map((l) => (
        <Tip key={l.id} content={l.id === 'max' && note ? `${l.description} ${note}` : l.description}>
          <button
            type="button"
            role="radio"
            aria-checked={value === l.id}
            onClick={() => onChange(l.id)}
            className={cn(
              'flex grow items-center justify-center gap-2 rounded-md px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === l.id ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PerformanceBars level={l.id} size="sm" running={running && value === l.id} className={value === l.id ? '' : 'opacity-50 grayscale'} />
            {l.label}
          </button>
        </Tip>
      ))}
    </div>
  )
}

export function PageHeader({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {meta && <span className="font-mono text-xs text-subtle-foreground">{meta}</span>}
        {children}
      </div>
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border bg-card', className)}>{children}</div>
}
