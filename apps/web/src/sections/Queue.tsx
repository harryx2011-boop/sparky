import { formatDuration } from '@sparky/core'
import { cn } from '@sparky/ui'
import { ArrowLeftRight, Check, Download, GripVertical, Pause } from 'lucide-react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Eyebrow, Heading, Lead } from '../components/ui'

interface SimJob {
  id: number
  name: string
  kind: 'convert' | 'download'
  /** Percent per tick. */
  rate: number
  speed: string
  progress: number
}

const SCRIPT: Omit<SimJob, 'progress'>[] = [
  { id: 1, name: 'trip-recap.mov → MP4', kind: 'convert', rate: 0.9, speed: '3.1x' },
  { id: 2, name: 'Night bus home → MP3', kind: 'download', rate: 1.5, speed: '6.4 MB/s' },
  { id: 3, name: 'photos.zip → 7Z', kind: 'convert', rate: 2.2, speed: '41 MB/s' },
  { id: 4, name: 'Paper lanterns → MP3', kind: 'download', rate: 1.7, speed: '5.8 MB/s' },
  { id: 5, name: 'report.docx → PDF', kind: 'convert', rate: 4, speed: '1 page/s' },
  { id: 6, name: 'IMG_2041.heic → JPG', kind: 'convert', rate: 5, speed: '12 photos/s' },
]

const AT_ONCE = 2
const TICK_MS = 140

function useSimulation(running: boolean) {
  const reduce = useReducedMotion()
  const [jobs, setJobs] = useState<SimJob[]>(() => SCRIPT.map((j, i) => ({ ...j, progress: i === 0 ? 64 : i === 1 ? 28 : 0 })))
  useEffect(() => {
    if (!running || reduce) return
    const id = window.setInterval(() => {
      setJobs((prev) => {
        if (prev.every((j) => j.progress >= 100)) return SCRIPT.map((j) => ({ ...j, progress: 0 }))
        let active = 0
        return prev.map((j) => {
          if (j.progress >= 100 || active >= AT_ONCE) return j
          active += 1
          const wobble = 0.6 + Math.random() * 0.8
          return { ...j, progress: Math.min(100, j.progress + j.rate * wobble) }
        })
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running, reduce])
  return jobs
}

export function Queue() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const jobs = useSimulation(inView)
  let slots = AT_ONCE
  const rows = jobs.map((j) => {
    const done = j.progress >= 100
    const running = !done && slots > 0
    if (running) slots -= 1
    return { ...j, done, running }
  })
  const runningCount = rows.filter((r) => r.running).length
  const doneCount = rows.filter((r) => r.done).length

  return (
    <section className="border-t border-[#161616] px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="flex max-w-[620px] flex-col gap-5">
            <Eyebrow index="04">Queue</Eyebrow>
            <Heading>Everything waits in one line.</Heading>
            <Lead>
              Downloads and conversions take turns together. See how fast each one is going and how long is left, then pause,
              drag to reorder or cancel whenever you like.
            </Lead>
          </div>
          <dl className="flex gap-8 font-mono text-sm">
            {[
              ['Running', runningCount],
              ['Finished', doneCount],
              ['At once', `${AT_ONCE} of 8`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-subtle-foreground">{k}</dt>
                <dd className="text-2xl text-foreground tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div ref={ref} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-11 items-center justify-between border-b border-border px-5 text-xs text-subtle-foreground">
            <span className="eyebrow !text-[10px]">Queue · {runningCount} running</span>
            <span className="flex items-center gap-1.5">
              <Pause size={12} /> Pause all
            </span>
          </div>
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((r) => {
                const eta = r.running ? ((100 - r.progress) / r.rate) * (TICK_MS / 1000) : undefined
                const Icon = r.kind === 'download' ? Download : ArrowLeftRight
                return (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-[#1a1a1a] px-5 py-3.5 text-[13px] last:border-b-0 sm:grid-cols-[16px_16px_minmax(0,220px)_minmax(0,1fr)_150px] sm:gap-x-4"
                  >
                    <GripVertical size={14} className="hidden text-[#3a3a3a] sm:block" />
                    <Icon size={14} className="text-subtle-foreground" />
                    <span className="truncate">{r.name}</span>
                    <span className="order-last col-span-full h-1 overflow-hidden rounded bg-track sm:order-none sm:col-span-1">
                      <span
                        className={cn('block h-full rounded transition-[width] duration-150', r.running ? 'sp-shimmer' : 'bg-foreground')}
                        style={{ width: `${r.progress}%` }}
                      />
                    </span>
                    <span className="text-right font-mono text-xs text-subtle-foreground">
                      {r.done ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check size={12} /> Done
                        </span>
                      ) : r.running ? (
                        `${r.speed} · ${formatDuration(eta)}`
                      ) : (
                        'Waiting'
                      )}
                    </span>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </section>
  )
}
