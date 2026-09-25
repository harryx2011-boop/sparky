import { PERFORMANCE_LEVELS, performanceInfo, type PerformanceLevel } from '@sparky/core'
import { cn, PerformanceBars } from '@sparky/ui'
import { Gauge, Leaf, Zap, type LucideIcon } from 'lucide-react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { useRef } from 'react'
import { Heading, Lead } from '../components/ui'
import { useMediaQuery } from '../hooks'
import { useDemo } from '../state'

const ICONS: Record<PerformanceLevel, LucideIcon> = { low: Leaf, normal: Gauge, max: Zap }

export function Performance() {
  const ref = useRef<HTMLDivElement>(null)
  const { level, setLevel } = useDemo()
  const large = useMediaQuery('(min-width: 1024px)')
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const lastStep = useRef(-1)

  // Scrolling through the pinned section walks Low → Normal → Max.
  // A click still wins until the next step is crossed.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!large || reduce) return
    const step = v < 0.3 ? 0 : v < 0.62 ? 1 : 2
    if (step !== lastStep.current) {
      lastStep.current = step
      setLevel(PERFORMANCE_LEVELS[step]!.id)
    }
  })

  const Icon = ICONS[level]
  return (
    <section id="performance" className="border-t border-[#161616] px-4 sm:px-6">
      <div ref={ref} className="relative mx-auto max-w-[1200px] lg:h-[240vh]">
        <div className="flex flex-col items-center gap-12 py-24 lg:sticky lg:top-0 lg:h-screen lg:justify-center lg:py-0">
          <div className="flex max-w-[640px] flex-col items-center gap-5 text-center">
            <Heading lines={['You decide how hard it works.']} />
            <Lead>Keep it quiet while you game or take a call, or let Sparky use everything your PC has for a big batch.</Lead>
          </div>

          <div className="grid w-full max-w-[960px] grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
            <div className="flex flex-col items-center gap-5">
              <div className="flex h-[200px] items-end">
                <PerformanceBars level={level} size="lg" running />
              </div>
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Icon size={15} />
                {performanceInfo(level).outcome}
              </span>
            </div>

            <div role="radiogroup" aria-label="Performance level" className="flex flex-col overflow-hidden rounded-2xl border border-border">
              {PERFORMANCE_LEVELS.map((l) => {
                const selected = l.id === level
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLevel(l.id)}
                    className={cn(
                      'relative flex items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      selected
                        ? 'bg-[#161616] text-foreground before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-lime'
                        : 'bg-[#0f0f0f] text-muted-foreground hover:bg-[#131313]',
                    )}
                  >
                    <PerformanceBars level={l.id} size="md" running={selected} className={selected ? '' : 'opacity-60'} />
                    <span className="flex flex-col gap-1">
                      <span className="text-base font-semibold">{l.label}</span>
                      <span className="text-[13px] leading-snug">{l.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
