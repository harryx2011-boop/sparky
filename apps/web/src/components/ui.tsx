import { cn } from '@sparky/ui'
import { motion, useReducedMotion } from 'motion/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { SplitText } from './motion'

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: 'primary' | 'secondary'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        size === 'sm' && 'h-9 px-3.5 text-[13px]',
        size === 'md' && 'h-11 px-[18px] text-sm',
        size === 'lg' && 'h-[50px] px-6 text-[15px]',
        variant === 'primary' ? 'border-lime bg-lime text-lime-foreground hover:bg-lime/90' : 'border-input bg-[#141414] text-foreground hover:bg-[#1c1c1c]',
        className,
      )}
      {...props}
    />
  )
}

/** Fades and lifts content in as it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 40 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Section heading. Each line's words rise into place when it scrolls into view. */
export function Heading({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h2 className={cn('text-balance text-[clamp(36px,calc(2vw+24px),52px)] font-bold leading-[1.04] tracking-[-0.035em]', className)}>
      {lines.map((l, i) => (
        <span key={l} className="block">
          <SplitText text={l} inView delay={i * 0.18} />
        </span>
      ))}
    </h2>
  )
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg', className)}>{children}</p>
}

const SPARK_POSITIONS = [
  [14, 12, 0], [23, 38, 0.8], [82, 16, 1.4], [88, 44, 0.3], [33, 6, 2.1], [70, 9, 1.1], [9, 60, 2.6], [93, 28, 1.8],
  [48, 3, 0.5], [60, 52, 2.3], [4, 30, 1.6], [77, 64, 0.9],
] as const

/** Twinkling dots scattered over a section. Positions are in percent. */
export function Sparks({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {SPARK_POSITIONS.slice(0, count).map(([x, y, d], i) => (
        <span key={i} className="sp-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
      ))}
    </div>
  )
}
