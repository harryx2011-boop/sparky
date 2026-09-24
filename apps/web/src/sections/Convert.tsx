import { formatBytes } from '@sparky/core'
import { cn, CompressionSlider, PerformanceBars, ResolutionPicker } from '@sparky/ui'
import { Archive, Check, FileText, Image, Music, Upload, Video, type LucideIcon } from 'lucide-react'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Eyebrow, Heading, Lead, Reveal } from '../components/ui'
import { useMediaQuery } from '../hooks'
import { useDemo } from '../state'

interface Example {
  row: number
  icon: LucideIcon
  name: string
  from: string
  to: string
  before: number
  after: number
}

const MB = 1024 * 1024
const EXAMPLES: Example[] = [
  { row: 0, icon: Video, name: 'trip-recap', from: 'MOV', to: 'MP4', before: 318 * MB, after: 96 * MB },
  { row: 2, icon: Image, name: 'IMG_2041', from: 'HEIC', to: 'JPG', before: 4.2 * MB, after: 1.1 * MB },
  { row: 3, icon: FileText, name: 'report', from: 'DOCX', to: 'PDF', before: 2.4 * MB, after: 0.62 * MB },
  { row: 1, icon: Music, name: 'interview', from: 'WAV', to: 'MP3', before: 86 * MB, after: 12 * MB },
]

const ROWS: { icon: LucideIcon; label: string; formats: string }[] = [
  { icon: Video, label: 'Video', formats: 'MP4 · MKV · MOV · WEBM · AVI → GIF or just the sound' },
  { icon: Music, label: 'Audio', formats: 'MP3 · WAV · FLAC · M4A · OGG' },
  { icon: Image, label: 'Images', formats: 'PNG · JPG · WEBP · HEIC · BMP → AVIF, ICO' },
  { icon: FileText, label: 'Documents', formats: 'DOCX · MD · HTML · PDF · TXT' },
  { icon: Archive, label: 'Archives', formats: 'ZIP · 7Z · RAR, or unpack to a folder' },
]

/**
 * Drives the scene: follows the scroll on big screens,
 * plays on a loop on small ones, and holds still for reduced motion.
 */
function useSceneProgress(target: React.RefObject<HTMLElement | null>, scrollDriven: boolean): MotionValue<number> {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] })
  const loop = useMotionValue(reduce ? 0.2 : 0)
  const inView = useInView(target, { amount: 0.3 })
  useEffect(() => {
    if (scrollDriven || reduce || !inView) return
    const controls = animate(loop, [0, 0.9999], { duration: 14, ease: 'linear', repeat: Infinity })
    return () => controls.stop()
  }, [scrollDriven, reduce, inView, loop])
  return scrollDriven && !reduce ? scrollYProgress : loop
}

function DropScene({ progress, onRow }: { progress: MotionValue<number>; onRow: (row: number) => void }) {
  const n = EXAMPLES.length
  const [index, setIndex] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => setIndex(Math.min(n - 1, Math.floor(Math.min(v, 0.9999) * n))))
  const local = useTransform(progress, (v) => (Math.min(v, 0.9999) * n) % 1)
  const ex = EXAMPLES[index]!

  const y = useTransform(local, [0, 0.28], [-240, 0])
  const rotate = useTransform(local, [0, 0.28], [-12, 0])
  const enter = useTransform(local, [0, 0.12, 0.9, 1], [0, 1, 1, 0])
  const morph = useTransform(local, [0.36, 0.62], [0, 1])
  const oldOpacity = useTransform(morph, [0, 0.5], [1, 0])
  const newOpacity = useTransform(morph, [0.5, 1], [0, 1])
  const bar = useTransform(morph, (m) => `${m * 100}%`)
  const size = useTransform(morph, (m) => formatBytes(ex.before + (ex.after - ex.before) * m))
  const done = useTransform(local, [0.66, 0.74], [0, 1])
  const zoneGlow = useTransform(local, [0.2, 0.3, 0.4], [0, 1, 0])
  useEffect(() => onRow(ex.row), [ex.row, onRow])
  const Icon = ex.icon
  const saved = Math.round((1 - ex.after / ex.before) * 100)

  return (
    <div className="relative flex h-[420px] items-end justify-center overflow-hidden rounded-2xl border border-border bg-[#0e0e0e] p-6 sm:h-[460px]">
      <motion.div
        aria-hidden
        style={{ opacity: zoneGlow }}
        className="absolute inset-x-6 bottom-6 h-[210px] rounded-xl bg-[radial-gradient(closest-side,rgba(237,237,237,.12),transparent)]"
      />
      <div className="relative flex h-[210px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#2e2e2e] text-[13px] text-subtle-foreground">
        <Upload size={20} />
        Drop files here
      </div>

      <motion.div style={{ y, rotate, opacity: enter }} className="absolute bottom-[74px] left-1/2 w-[min(340px,80%)] -translate-x-1/2">
        <div className="rounded-xl border border-input bg-card p-4 shadow-[0_20px_60px_rgba(0,0,0,.5)]">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Icon size={18} />
            </span>
            <div className="min-w-0 grow">
              <div className="flex items-center truncate text-sm font-medium">
                {ex.name}.
                <span className="relative inline-block w-12">
                  <motion.span style={{ opacity: oldOpacity }} className="absolute inset-0 font-mono lowercase">
                    {ex.from}
                  </motion.span>
                  <motion.span style={{ opacity: newOpacity }} className="absolute inset-0 font-mono lowercase">
                    {ex.to}
                  </motion.span>
                  &nbsp;
                </span>
              </div>
              <motion.div className="font-mono text-xs text-subtle-foreground">{size}</motion.div>
            </div>
            <motion.span style={{ opacity: done }} className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
              <Check size={14} strokeWidth={3} />
            </motion.span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded bg-track">
            <motion.div style={{ width: bar }} className="h-full rounded bg-foreground" />
          </div>
          <motion.div style={{ opacity: done }} className="mt-2.5 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>
              {ex.from} → {ex.to}
            </span>
            <span className="text-success">{saved}% smaller</span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

function CategoryList({ active }: { active: number }) {
  return (
    <ul className="flex flex-col">
      {ROWS.map((r, i) => (
        <li
          key={r.label}
          className={cn(
            'flex items-start gap-4 border-t border-border py-3.5 transition-colors duration-500 last:border-b',
            i === active ? 'text-foreground' : 'text-subtle-foreground',
          )}
        >
          <r.icon size={16} className="mt-0.5 shrink-0" />
          <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-wider">{r.label}</span>
          <span className={cn('text-sm transition-colors duration-500', i === active ? 'text-foreground' : 'text-muted-foreground')}>{r.formats}</span>
        </li>
      ))}
    </ul>
  )
}

function SettingsStrip() {
  const { level, compression, setCompression, resolution, setResolution, options } = useDemo()
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3 bg-card p-6 sm:p-7">
        <span className="text-[15px] font-semibold">Make it smaller, your way</span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Five steps from “looks identical” to “fits in an email”. Pick the same format you started with to shrink a file without
          changing it.
        </p>
        <CompressionSlider value={compression} onChange={setCompression} className="mt-2" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 bg-card p-6 sm:p-7">
        <span className="flex items-center justify-between text-[15px] font-semibold">
          Up to 4K
          <PerformanceBars level={level} size="sm" running />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          1440p and 4K open up when your video is that sharp, your graphics card can help, and Performance is on Max. Sparky
          never stretches a small video bigger.
        </p>
        <ResolutionPicker options={options} value={resolution} onChange={setResolution} className="mt-2" />
      </div>
    </div>
  )
}

export function Convert() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const large = useMediaQuery('(min-width: 1024px)')
  const progress = useSceneProgress(sceneRef, large)
  const [row, setRow] = useState(0)
  return (
    <section id="convert" className="border-t border-[#161616] px-4 sm:px-6">
      <div ref={sceneRef} className="relative mx-auto max-w-[1200px] lg:h-[300vh]">
        <div className="grid grid-cols-1 items-center gap-12 py-24 lg:sticky lg:top-0 lg:h-screen lg:grid-cols-2 lg:gap-20 lg:py-0">
          <div className="flex flex-col gap-5">
            <Eyebrow index="01">Convert</Eyebrow>
            <Heading>
              Drop anything.
              <br />
              Get what you need.
            </Heading>
            <Lead>Videos, songs, photos, documents and zip files, all changed right on your computer. Drag them in, pick a format, done.</Lead>
            <CategoryList active={row} />
          </div>
          <DropScene progress={progress} onRow={setRow} />
        </div>
      </div>
      <Reveal className="mx-auto max-w-[1200px] pb-28">
        <SettingsStrip />
      </Reveal>
    </section>
  )
}
