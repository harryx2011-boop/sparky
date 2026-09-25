import { cn, FileIcon, LogoMark } from '@sparky/ui'
import { ArrowLeftRight, Check, Download, History, List, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BEATS, FILL, FINAL, reached, type Beat } from '../install-timeline'
import { FitToWidth } from './AppWindow'
import { SpriteField } from './SpriteField'

const W = 640
const H = 420
const EASE = [0.23, 1, 0.32, 1] as const
const FILL_EASE = [0.33, 1, 0.68, 1] as const
const ENTER = { duration: 0.24, ease: EASE }
const LEAVE = { duration: 0.18, ease: EASE }
const bolt = () => 0

function Fill({ seconds }: { seconds: number }) {
  return (
    <div className="h-1 overflow-hidden rounded bg-track">
      <motion.div className="h-full origin-left rounded bg-lime" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: seconds, delay: 0.15, ease: FILL_EASE }} />
    </div>
  )
}

function TitleBar({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn('flex h-9 shrink-0 items-center justify-between border-b border-[#1c1c1c] pl-3.5 text-xs text-subtle-foreground', className)}>
      <span className="flex items-center gap-2">
        <LogoMark size={14} />
        {title}
      </span>
      <span className="flex h-9">
        {['—', '✕'].map((c) => (
          <span key={c} className="flex w-10 items-center justify-center">
            {c}
          </span>
        ))}
      </span>
    </div>
  )
}

function Swap({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <motion.span className="absolute inset-0 flex items-center" initial={false} animate={{ opacity: on ? 1 : 0 }} transition={ENTER}>
      {children}
    </motion.span>
  )
}

function NavItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span className={cn('relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[12px]', active ? 'bg-[#1a1a1a] text-foreground before:absolute before:left-0 before:top-1/2 before:h-3.5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-lime' : 'text-muted-foreground')}>
      {icon}
      {label}
    </span>
  )
}

function DownloadCard({ beat }: { beat: Beat }) {
  const saved = reached(beat, 'install')
  return (
    <motion.div
      className="absolute right-4 top-4 flex w-[272px] items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-3.5 shadow-[0_16px_40px_rgba(0,0,0,.5)]"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: LEAVE }}
      transition={ENTER}
    >
      <LogoMark size={32} />
      <div className="flex min-w-0 grow flex-col gap-2">
        <span className="truncate text-[13px]">Sparky-Setup.exe</span>
        <span className="relative block h-4">
          <Swap on={!saved}>
            <span className="w-full">
              <Fill seconds={FILL.download} />
            </span>
          </Swap>
          <Swap on={saved}>
            <span className="text-xs text-subtle-foreground">Open file</span>
          </Swap>
        </span>
      </div>
    </motion.div>
  )
}

function Installer() {
  return (
    <motion.div
      className="absolute left-[130px] top-[112px] flex w-[380px] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#101010] shadow-[0_30px_80px_rgba(0,0,0,.6)]"
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: LEAVE }}
      transition={ENTER}
    >
      <TitleBar title="Sparky Setup" />
      <div className="flex items-center gap-4 px-5 py-6">
        <LogoMark size={44} />
        <div className="flex grow flex-col gap-3">
          <span className="text-[15px] font-semibold">Installing Sparky</span>
          <Fill seconds={FILL.install} />
        </div>
      </div>
    </motion.div>
  )
}

function Launch() {
  return (
    <motion.div className="absolute inset-x-0 top-0 bottom-11" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: LEAVE }} transition={ENTER}>
      <SpriteField getProgress={bolt} boltScale={0.5} boltY={0.5} className="size-full" />
    </motion.div>
  )
}

function App({ beat }: { beat: Beat }) {
  const done = reached(beat, 'done')
  return (
    <motion.div
      className="absolute left-[50px] top-8 flex h-[300px] w-[540px] flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0e0e0e] shadow-[0_30px_80px_rgba(0,0,0,.6)]"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: LEAVE }}
      transition={ENTER}
    >
      <TitleBar title="Sparky" />
      <div className="flex min-h-0 grow">
        <div className="flex w-[140px] shrink-0 flex-col gap-0.5 border-r border-[#1c1c1c] px-2 py-3">
          <NavItem active icon={<ArrowLeftRight size={13} />} label="Convert" />
          <NavItem icon={<Download size={13} />} label="Download" />
          <NavItem icon={<List size={13} />} label="Queue" />
          <NavItem icon={<History size={13} />} label="History" />
        </div>
        <div className="flex grow flex-col gap-4 px-5 py-5">
          <span className="text-[15px] font-semibold">Convert</span>
          <div className="flex items-center gap-3 rounded-lg border border-[#1f1f1f] px-3.5 py-3">
            <span className="relative size-7 shrink-0">
              <Swap on={!done}>
                <FileIcon ext="mov" size={28} />
              </Swap>
              <Swap on={done}>
                <FileIcon ext="mp4" size={28} />
              </Swap>
            </span>
            <div className="flex min-w-0 grow flex-col gap-2">
              <span className="relative block h-[18px] text-[13px]">
                <Swap on={!done}>trip-recap.mov</Swap>
                <Swap on={done}>trip-recap.mp4</Swap>
              </span>
              <span className="relative block h-4">
                <Swap on={!done}>
                  <span className="w-full">
                    <Fill seconds={FILL.convert} />
                  </span>
                </Swap>
                <Swap on={done}>
                  <span className="font-mono text-[11px] text-subtle-foreground">Downloads\Sparky</span>
                </Swap>
              </span>
            </div>
            <span className="relative h-5 w-14 shrink-0 text-xs">
              <Swap on={!done}>
                <span className="w-full text-right font-mono text-subtle-foreground">MP4</span>
              </Swap>
              <Swap on={done}>
                <span className="flex w-full items-center justify-end gap-1 text-success">
                  <Check size={14} />
                  Done
                </span>
              </Swap>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/** Sparky's installer arrives, installs, and Sparky opens to convert a file. Plays once in view and holds the last frame. */
export function InstallSequence({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const [beat, setBeat] = useState<Beat | null>(reduce ? FINAL : null)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      setBeat(FINAL)
      return
    }
    setBeat(BEATS[0]!.beat)
    const timers = BEATS.slice(1).map(({ beat: next, at }) => window.setTimeout(() => setBeat(next), at))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [inView, reduce, run])

  const running = reached(beat, 'launch')
  return (
    <div ref={ref} className={cn('flex flex-col', className)}>
      <FitToWidth width={W} height={H}>
        <div
          role="img"
          aria-label="Sparky-Setup.exe downloads and installs, then Sparky opens and converts trip-recap.mov to MP4."
          className="relative size-full overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0c0c0c] shadow-[0_40px_120px_rgba(0,0,0,.6)]"
        >
          <AnimatePresence initial={false}>
            {beat === 'launch' && <Launch key="launch" />}
            {beat && !reached(beat, 'launch') && <DownloadCard key="card" beat={beat} />}
            {beat === 'install' && <Installer key="installer" />}
            {beat && reached(beat, 'convert') && <App key="app" beat={beat} />}
          </AnimatePresence>
          <div className="absolute inset-x-0 bottom-0 flex h-11 items-center justify-center border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <motion.span
              className="relative flex flex-col items-center"
              initial={false}
              animate={running ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={ENTER}
            >
              <LogoMark size={24} />
              <span className="absolute -bottom-[7px] h-[3px] w-3 rounded-full bg-lime" />
            </motion.span>
          </div>
        </div>
      </FitToWidth>
      <div className="flex h-10 items-end justify-end">
        <AnimatePresence>
          {beat === FINAL && !reduce && (
            <motion.button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-subtle-foreground transition-colors duration-150 hover:text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: LEAVE }}
              transition={ENTER}
            >
              <RotateCcw size={13} />
              Replay
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
