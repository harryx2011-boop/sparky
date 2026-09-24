import { cn } from '@sparky/ui'

/** Thin progress bar. A negative value shows an indeterminate shimmer. */
export function Progress({ value, running, className, tone }: { value: number; running?: boolean; className?: string; tone?: 'default' | 'success' | 'error' | 'muted' }) {
  const indeterminate = value < 0
  const pct = indeterminate ? 100 : Math.max(0, Math.min(100, value * 100))
  return (
    <div className={cn('h-1 overflow-hidden rounded-full bg-track', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : Math.round(pct)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          running ? 'sp-shimmer' : tone === 'success' ? 'bg-success' : tone === 'error' ? 'bg-destructive' : tone === 'muted' ? 'bg-subtle-foreground' : 'bg-foreground',
          indeterminate && running && 'opacity-60',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
