import { formatBytes } from '@sparky/core'
import { Bolt, cn, LogoMark, PerformanceBars } from '@sparky/ui'
import { Check, ChevronDown, FileText, Image, Music, Search, Upload, Video, type LucideIcon } from 'lucide-react'
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FitToWidth } from '../components/AppWindow'
import { Marquee, SplitText } from '../components/motion'

const MB = 1024 * 1024
const W = 1100
const H = 540

interface Example {
  name: string
  from: string
  to: string
  options: string[]
  before: number
  after: number
  icon: LucideIcon
}

const EXAMPLES: Example[] = [
  { name: 'trip-recap', from: 'MOV', to: 'MP4', options: ['MP4', 'WEBM', 'GIF', 'MP3'], before: 318 * MB, after: 96 * MB, icon: Video },
  { name: 'IMG_2041', from: 'HEIC', to: 'JPG', options: ['PNG', 'JPG', 'WEBP', 'AVIF'], before: 4.2 * MB, after: 1.1 * MB, icon: Image },
  { name: 'interview', from: 'WAV', to: 'MP3', options: ['FLAC', 'M4A', 'MP3', 'OGG'], before: 86 * MB, after: 12 * MB, icon: Music },
  { name: 'report', from: 'DOCX', to: 'PDF', options: ['PDF', 'MD', 'HTML', 'TXT'], before: 2.4 * MB, after: 0.62 * MB, icon: FileText },
]

// Where things sit on the fixed 1100×540 stage.
const TILES = [
  { x: 100, y: 160 },
  { x: 240, y: 160 },
  { x: 100, y: 330 },
  { x: 240, y: 330 },
]
const HOME = { x: 300, y: 480 }
const DROP = { x: 750, y: 130 }
const PICKER = { x: 594, y: 316 }
const MENU_TOP = 344
const ITEM_H = 34
const CONVERT = { x: 1010, y: 494 }

type Phase = 'idle' | 'drag' | 'over' | 'dropped' | 'menu' | 'picked' | 'converting' | 'done'

const CAPTIONS: Record<Phase, (ex: Example) => string> = {
  idle: (ex) => `Grabbing ${ex.name}.${ex.from.toLowerCase()}`,
  drag: () => 'Dragging it into Sparky',
  over: () => 'Let go anywhere in the window',
  dropped: () => 'Sparky reads the file',
  menu: () => 'Picking a format',
  picked: (ex) => `${ex.to} it is`,
  converting: () => 'Converting right on your PC',
  done: (ex) => `Done: ${Math.round((1 - ex.after / ex.before) * 100)}% smaller`,
}

class Stop extends Error {}

function Cursor({ x, y, pressed }: { x: MotionValue<number>; y: MotionValue<number>; pressed: boolean }) {
  return (
    <motion.div className="pointer-events-none absolute left-0 top-0 z-40" style={{ x, y }}>
      <motion.svg width="26" height="26" viewBox="0 0 24 24" animate={{ scale: pressed ? 0.84 : 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }} className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_4px_10px_rgba(0,0,0,.6)]">
        <path d="M4 2.5 19.5 12l-6.6 1.5 3.7 7.3-2.9 1.4-3.6-7.4L5 19.5z" fill="#fafafa" stroke="#0a0a0a" strokeWidth="1.3" strokeLinejoin="round" />
      </motion.svg>
    </motion.div>
  )
}

function Ripple({ at }: { at: { x: number; y: number; id: number } | null }) {
  return (
    <AnimatePresence>
      {at && (
        <motion.span
          key={at.id}
          className="pointer-events-none absolute z-30 size-10 rounded-full border-2 border-foreground/70"
          style={{ left: at.x - 20, top: at.y - 20 }}
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 1.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  )
}

function Burst({ play, x, y }: { play: boolean; x: number; y: number }) {
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: x, top: y }}>
      {play &&
        Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2
          const d = 38 + (i % 3) * 18
          const colors = ['#ededed', '#ffd166', '#ff7a45', '#8fb8ff', '#8b7cf6']
          return (
            <motion.span
              key={i}
              className="absolute size-[4px] rounded-full"
              style={{ background: colors[i % colors.length] }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }}
              animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.3 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          )
        })}
    </div>
  )
}

function Stage() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.35 })
  const cx = useMotionValue(HOME.x)
  const cy = useMotionValue(HOME.y)
  const progress = useMotionValue(0)
  const [exIndex, setExIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(reduce ? 'done' : 'idle')
  const [pressed, setPressed] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [format, setFormat] = useState<string | null>(reduce ? EXAMPLES[0]!.to : null)
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null)
  const ex = EXAMPLES[exIndex]!

  const pct = useTransform(progress, (p) => `${Math.round(p * 100)}%`)
  const width = useTransform(progress, (p) => `${p * 100}%`)
  const size = useTransform(progress, (p) => formatBytes(ex.before + (ex.after - ex.before) * p))

  useEffect(() => {
    if (!inView || reduce) return
    let stopped = false
    const running: { stop: () => void }[] = []
    const check = () => {
      if (stopped) throw new Stop()
    }
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => (stopped ? reject(new Stop()) : resolve()), ms)
        running.push({ stop: () => window.clearTimeout(t) })
      })
    const move = async (to: { x: number; y: number }, duration: number, via?: { x: number; y: number }) => {
      check()
      const ease = [0.45, 0, 0.2, 1] as const
      const ax = animate(cx, via ? [cx.get(), via.x, to.x] : to.x, { duration, ease })
      const ay = animate(cy, via ? [cy.get(), via.y, to.y] : to.y, { duration, ease })
      running.push(ax, ay)
      await Promise.all([ax, ay])
      check()
    }
    const click = async () => {
      setPressed(true)
      setRipple({ x: cx.get(), y: cy.get(), id: Date.now() })
      await wait(140)
      setPressed(false)
    }

    const run = async () => {
      let i = exIndex
      for (;;) {
        const e = EXAMPLES[i]!
        const tile = TILES[i]!
        setExIndex(i)
        setPhase('idle')
        setFormat(null)
        setHover(null)
        progress.set(0)
        await move({ x: tile.x + 8, y: tile.y + 6 }, 0.9)
        setPressed(true)
        await wait(160)
        setPhase('drag')
        await move({ x: DROP.x, y: DROP.y }, 1.15, { x: (tile.x + DROP.x) / 2, y: Math.min(tile.y, DROP.y) - 70 })
        setPhase('over')
        await wait(320)
        setPressed(false)
        setPhase('dropped')
        await wait(650)
        await move(PICKER, 0.7)
        await click()
        setPhase('menu')
        await wait(380)
        const target = e.options.indexOf(e.to)
        for (let k = 0; k <= target; k++) {
          await move({ x: PICKER.x - 40, y: MENU_TOP + ITEM_H * k + ITEM_H / 2 }, k === 0 ? 0.35 : 0.18)
          setHover(k)
          await wait(110)
        }
        await click()
        setFormat(e.to)
        setPhase('picked')
        await wait(350)
        await move(CONVERT, 0.75)
        await click()
        setPhase('converting')
        const c = animate(progress, 1, { duration: 1.8, ease: [0.3, 0, 0.2, 1] })
        running.push(c)
        await c
        check()
        setPhase('done')
        await wait(1700)
        await move(HOME, 0.8)
        i = (i + 1) % EXAMPLES.length
      }
    }
    run().catch((err) => {
      if (!(err instanceof Stop)) throw err
    })
    return () => {
      stopped = true
      running.forEach((r) => r.stop())
    }
    // exIndex is read once so the loop resumes where it left off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce])

  const inWindow = phase !== 'idle' && phase !== 'drag' && phase !== 'over'
  const Icon = ex.icon
  const shownExt = phase === 'converting' || phase === 'done' ? ex.to : ex.from

  return (
    <div ref={ref} className="relative select-none" style={{ width: W, height: H }}>
      {/* Desktop with files */}
      <div className="absolute left-0 top-0 h-full w-[340px] overflow-hidden rounded-2xl border border-border bg-[radial-gradient(120%_80%_at_20%_0%,#1b1b2a,#0d0d0d_60%)]">
        <div className="flex h-10 items-center gap-2 border-b border-white/5 px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-subtle-foreground">Desktop</div>
        {EXAMPLES.map((e, i) => {
          const T = TILES[i]!
          const lifted = i === exIndex && (phase === 'drag' || phase === 'over' || inWindow)
          return (
            <motion.div
              key={e.name}
              className="absolute flex w-[112px] flex-col items-center gap-2"
              style={{ left: T.x - 56, top: T.y - 44 }}
              animate={{ opacity: lifted ? 0.18 : 1, scale: i === exIndex && phase === 'idle' && pressed ? 0.94 : 1 }}
            >
              <span className={cn('flex size-14 items-center justify-center rounded-xl border bg-card', i === exIndex && phase === 'idle' ? 'border-foreground/60' : 'border-border')}>
                <e.icon size={22} />
              </span>
              <span className="text-center text-[12px] leading-tight text-muted-foreground">
                {e.name}.{e.from.toLowerCase()}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Sparky window */}
      <div className="absolute left-[400px] top-0 flex h-full w-[700px] flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0e0e0e] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#1c1c1c] px-4 text-xs text-subtle-foreground">
          <LogoMark size={16} /> Sparky
        </div>
        <div className="relative flex grow flex-col gap-4 p-7">
          <motion.div
            animate={{
              borderColor: phase === 'over' ? 'rgba(237,237,237,.8)' : 'rgba(46,46,46,1)',
              backgroundColor: phase === 'over' ? 'rgba(237,237,237,.06)' : 'rgba(0,0,0,0)',
              scale: phase === 'over' ? 1.015 : 1,
            }}
            className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] text-subtle-foreground"
          >
            <motion.span animate={phase === 'over' ? { y: [0, -4, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: phase === 'over' ? Infinity : 0 }}>
              <Upload size={20} />
            </motion.span>
            {phase === 'over' ? 'Let go to add it' : 'Drop files here, or click to browse'}
          </motion.div>

          <div className="h-[56px]">
            <AnimatePresence mode="popLayout">
              {inWindow && (
                <motion.div
                  key={ex.name}
                  initial={{ opacity: 0, y: -40, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="relative flex h-[56px] items-center gap-3 overflow-hidden rounded-[10px] border border-[#1f1f1f] bg-[#121212] px-3.5 text-[13px]"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                    <Icon size={15} />
                  </span>
                  <span className="flex grow items-center">
                    {ex.name}.
                    <AnimatePresence mode="wait">
                      <motion.span key={shownExt} initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }} className="font-mono lowercase">
                        {shownExt}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <motion.span className="font-mono text-xs text-subtle-foreground">{phase === 'converting' || phase === 'done' ? size : formatBytes(ex.before)}</motion.span>
                  {phase === 'converting' && <motion.span className="w-10 text-right font-mono text-xs">{pct}</motion.span>}
                  <AnimatePresence>
                    {phase === 'done' && (
                      <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
                        <Check size={14} strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent">
                    <motion.div className={cn('h-full', phase === 'converting' ? 'sp-shimmer' : 'bg-foreground')} style={{ width }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            <div className="flex w-[332px] flex-col gap-1.5">
              <span className="text-[11px] text-subtle-foreground">Output format</span>
              <div className={cn('flex h-9 items-center justify-between rounded-lg border bg-[#121212] px-3 text-[13px] transition-colors', phase === 'menu' ? 'border-foreground/60' : 'border-[#2a2a2a]')}>
                <span className="flex items-center gap-2">
                  <Search size={13} className="text-subtle-foreground" />
                  <AnimatePresence mode="wait">
                    <motion.span key={format ?? 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={format ? '' : 'text-subtle-foreground'}>
                      {format ? `${format} · Balanced` : 'Pick a format'}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <ChevronDown size={14} className="text-subtle-foreground" />
              </div>
            </div>
            <div className="flex grow flex-col gap-1.5">
              <span className="text-[11px] text-subtle-foreground">Performance</span>
              <div className="flex h-9 items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#121212] px-3 text-[13px]">
                <span className="flex items-center gap-2">
                  <Bolt size={13} strokeWidth={2} /> Max
                </span>
                <PerformanceBars level="max" running={phase === 'converting'} />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {phase === 'menu' && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="absolute z-20 w-[332px] overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#161616] p-1 shadow-2xl"
                style={{ left: 28, top: MENU_TOP - 40 - 4 }}
              >
                {ex.options.map((o, k) => (
                  <div key={o} className={cn('flex items-center gap-2 rounded-md px-2 text-[13px] transition-colors', hover === k && 'bg-[#232323]')} style={{ height: ITEM_H }}>
                    <Check size={13} className={o === ex.to && hover === k ? 'opacity-100' : 'opacity-0'} />
                    <span className="font-medium">{o}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto flex items-center justify-between">
            <AnimatePresence mode="wait">
              <motion.span key={phase + ex.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} className={cn('font-mono text-xs', phase === 'done' ? 'text-success' : 'text-subtle-foreground')}>
                {CAPTIONS[phase](ex)}
              </motion.span>
            </AnimatePresence>
            <motion.span
              animate={{ scale: phase === 'picked' ? [1, 1.06, 1] : 1, opacity: format ? 1 : 0.45 }}
              transition={{ duration: 0.5 }}
              className="inline-flex h-9 w-[120px] items-center justify-center rounded-[10px] bg-primary text-[13px] font-medium text-primary-foreground"
            >
              {phase === 'converting' ? 'Converting…' : 'Convert'}
            </motion.span>
          </div>
        </div>
      </div>

      {/* The file being dragged */}
      <AnimatePresence>
        {(phase === 'drag' || phase === 'over') && (
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-30"
            style={{ x: cx, y: cy }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, rotate: phase === 'over' ? 0 : -6 }}
            exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.25 } }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-xl border border-foreground/40 bg-card/95 px-3 py-2 text-[12px] shadow-[0_16px_40px_rgba(0,0,0,.6)] backdrop-blur">
              <Icon size={16} />
              {ex.name}.{ex.from.toLowerCase()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Burst play={phase === 'done'} x={1040} y={232} />
      <Ripple at={ripple} />
      {!reduce && <Cursor x={cx} y={cy} pressed={pressed} />}
    </div>
  )
}

const PAIRS = ['MOV → MP4', 'HEIC → JPG', 'WAV → MP3', 'DOCX → PDF', 'MP4 → GIF', 'PNG → WEBP', 'FLAC → M4A', 'RAR → ZIP', 'MD → PDF', 'MKV → WEBM', 'PDF → TXT', 'JPG → AVIF']

export function DragDemo() {
  return (
    <section id="watch" className="relative border-t border-[#161616] py-24 lg:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 sm:px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="text-balance text-[40px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[56px]">
            <SplitText text="Drag it in. Pick a format." inView />
            <br />
            <SplitText text="That’s the whole trick." inView delay={0.25} className="text-muted-foreground" />
          </h2>
        </div>
        <FitToWidth width={W} height={H}>
          <Stage />
        </FitToWidth>
      </div>
      <div className="mt-20">
        <Marquee
          duration={36}
          items={PAIRS.map((p) => (
            <span className="font-mono text-2xl tracking-tight text-muted-foreground sm:text-3xl">{p}</span>
          ))}
        />
      </div>
    </section>
  )
}
