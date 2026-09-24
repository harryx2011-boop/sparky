import { performanceInfo, type PerformanceLevel } from '@sparky/core'
import { cn } from './cn'

const SIZES = {
  sm: { width: 4, gap: 2, heights: [6, 9, 12, 15, 18], radius: 2 },
  md: { width: 6, gap: 3, heights: [8, 13, 18, 23, 28], radius: 2 },
  lg: { width: 38, gap: 12, heights: [48, 84, 120, 156, 192], radius: 8 },
} as const

export interface PerformanceBarsProps {
  level: PerformanceLevel
  size?: keyof typeof SIZES
  /** Bars gently flicker while work is happening. */
  running?: boolean
  className?: string
}

/** Five bars that fill left to right: one for Low, three for Normal, five for Max. */
export function PerformanceBars({ level, size = 'sm', running = false, className }: PerformanceBarsProps) {
  const s = SIZES[size]
  const lit = performanceInfo(level).bars
  return (
    <span
      className={cn('sp-bars', className)}
      data-level={level}
      data-running={running ? '' : undefined}
      style={{ gap: s.gap }}
      role="img"
      aria-label={`Performance: ${performanceInfo(level).label}`}
    >
      {s.heights.map((h, i) => (
        <span
          key={i}
          className="sp-bar"
          data-on={i < lit ? '' : undefined}
          style={{ width: s.width, height: h, borderRadius: s.radius }}
        />
      ))}
    </span>
  )
}
