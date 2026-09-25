import { cn, LogoMark } from '@sparky/ui'
import { Bell, Clipboard, FolderOpen, History, Image, Inbox, RotateCcw, Scissors, Search, ShieldCheck, Subtitles, Tags, Trash2 } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TiltCard } from '../components/motion'
import { Heading } from '../components/ui'

function Tile({ className, icon, title, children, visual, delay = 0 }: { className?: string; icon: ReactNode; title: string; children: ReactNode; visual?: ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('rounded-2xl', className)}
    >
      <TiltCard className="h-full rounded-2xl">
        <article className="group flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-[#3a3a3a]">
          <div className="flex flex-col gap-2.5">
            <span className="text-foreground">{icon}</span>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
          </div>
          {visual && <div className="mt-auto">{visual}</div>}
        </article>
      </TiltCard>
    </motion.div>
  )
}

const HISTORY = [
  ['trip-recap.mov → MP4', 'Today · 96 MB'],
  ['Lo-fi for late nights → MP3', 'Today · 12 files'],
  ['report.docx → PDF', 'Yesterday · 640 KB'],
  ['IMG_2041.heic → JPG', 'Mon · 1.1 MB'],
  ['photos.zip → 7Z', 'Sun · 212 MB'],
] as const

function HistoryVisual() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-[#0d0d0d] px-3 text-[13px] text-subtle-foreground">
        <Search size={14} /> Search past jobs
      </div>
      <ul className="overflow-hidden rounded-lg border border-[#1f1f1f]">
        {HISTORY.map(([name, meta], i) => (
          <li key={name} className="flex h-11 items-center gap-3 border-b border-[#1a1a1a] px-3 text-[13px] last:border-b-0">
            <span className="grow truncate">{name}</span>
            <span className="hidden font-mono text-[11px] text-subtle-foreground sm:inline">{meta}</span>
            <span
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border border-input px-2 text-xs transition-colors',
                i === 1 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              <RotateCcw size={12} /> Run again
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClipboardVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.6 })
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!inView) return
    const t = window.setTimeout(() => setShown(true), 500)
    return () => window.clearTimeout(t)
  }, [inView])
  return (
    <div ref={ref} className="flex h-[72px] items-center rounded-xl border border-dashed border-[#2a2a2a] px-4">
      <motion.span
        initial={false}
        animate={shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-input bg-[#161616] pl-3 pr-1 text-[13px]"
      >
        <Clipboard size={14} className="shrink-0 text-muted-foreground" />
        <span className="truncate">
          Download this? <span className="font-mono text-subtle-foreground">youtu.be/night-bus</span>
        </span>
        <span className="shrink-0 rounded-full bg-lime px-3 py-1 text-xs font-medium text-lime-foreground">Download</span>
      </motion.span>
    </div>
  )
}

function ToastVisual() {
  return (
    <div className="rounded-lg border border-input bg-[#1b1b1b] p-3 shadow-[0_12px_30px_rgba(0,0,0,.45)]">
      <div className="flex items-center gap-2 text-[11px] text-subtle-foreground">
        <LogoMark size={14} /> Sparky · now
      </div>
      <div className="mt-1.5 text-[13px] font-medium">trip-recap.mp4 is ready</div>
      <div className="text-xs text-muted-foreground">70% smaller. Click to open.</div>
    </div>
  )
}

function SponsorVisual() {
  // A video timeline with the sponsor segments snipped out.
  const segments = [
    { w: 8, cut: true },
    { w: 34, cut: false },
    { w: 12, cut: true },
    { w: 40, cut: false },
    { w: 6, cut: true },
  ]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 gap-0.5">
        {segments.map((s, i) => (
          <span
            key={i}
            style={{ width: `${s.w}%` }}
            className={cn('h-full rounded-sm', s.cut ? 'bg-[repeating-linear-gradient(135deg,#3a3a3a_0_3px,transparent_3px_6px)] opacity-70' : 'bg-foreground')}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] text-subtle-foreground">3 segments skipped · 1:48 saved</span>
    </div>
  )
}

function ExtrasVisual() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] p-3">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,#3b3b3b,#171717)]">
        <Image size={18} className="text-muted-foreground" />
      </span>
      <div className="min-w-0 grow">
        <div className="truncate text-sm font-medium">Night bus home.mp3</div>
        <div className="truncate text-xs text-muted-foreground">Quiet Hours · Lo-fi for late nights · Track 2</div>
      </div>
      <span className="hidden shrink-0 font-mono text-[11px] text-subtle-foreground sm:inline">cover · names · chapters · subtitles</span>
    </div>
  )
}

export function Details() {
  return (
    <section id="details" className="border-t border-[#161616] px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <Heading lines={['The little things, already handled.']} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-6 lg:grid-rows-[auto_auto_auto_auto]">
          <Tile
            className="md:col-span-4 lg:col-span-3 lg:row-span-2"
            icon={<History size={20} />}
            title="History you can repeat"
            visual={<HistoryVisual />}
          >
            Every job is saved with its settings. Search for it, open the folder, or run it again with one click.
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-3" icon={<Clipboard size={20} />} title="Copy a link, get an offer" visual={<ClipboardVisual />} delay={0.05}>
            Copy a video link anywhere, switch to Sparky, and it asks if you want it.
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-2" icon={<Bell size={20} />} title="Tells you when it’s done" visual={<ToastVisual />} delay={0.1}>
            A Windows notification pops up. Click it to open the file.
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-1" icon={<Inbox size={20} />} title="Lives in the tray" delay={0.15}>
            Close the window and jobs keep going quietly.
          </Tile>
          <Tile className="md:col-span-2 lg:col-span-2" icon={<Scissors size={20} />} title="Skips the sponsor bits" visual={<SponsorVisual />} delay={0.05}>
            Ad reads and intros are cut out before the video reaches you.
          </Tile>
          <Tile
            className="md:col-span-4 lg:col-span-4"
            icon={
              <span className="flex gap-2">
                <Subtitles size={20} />
                <Tags size={20} />
              </span>
            }
            title="Subtitles, cover art and song names"
            visual={<ExtrasVisual />}
            delay={0.1}
          >
            Music shows up in your player with the right title, artist and artwork. Videos can carry their captions and chapters.
          </Tile>
          <Tile
            className="md:col-span-2 lg:col-span-4"
            icon={<ShieldCheck size={20} />}
            title="Nothing leaves your PC"
            visual={
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-4xl font-medium tracking-tight">0 bytes</span>
                <span className="text-sm text-subtle-foreground">uploaded, ever</span>
              </div>
            }
            delay={0.05}
          >
            Conversions run fully offline. No account, no tracking, no waiting on someone else’s server.
          </Tile>
          <Tile
            className="md:col-span-2 lg:col-span-2"
            icon={
              <span className="flex gap-2">
                <FolderOpen size={20} />
                <Trash2 size={20} />
              </span>
            }
            title="Your originals stay safe"
            delay={0.1}
          >
            Kept by default. If you choose to replace one, it goes to the Recycle Bin so you can always get it back.
          </Tile>
        </div>
      </div>
    </section>
  )
}
