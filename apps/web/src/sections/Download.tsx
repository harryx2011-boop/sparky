import { BrandMark, cn, LinkMark } from '@sparky/ui'
import { Link2, ListVideo, Play } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import { useRef, useState } from 'react'
import { Heading, Lead } from '../components/ui'

const LINK = 'youtube.com/playlist?list=lofi-for-late-nights'

const ITEMS = [
  { title: 'Rainy window, warm tea', len: '3:42' },
  { title: 'Night bus home', len: '4:05' },
  { title: 'Paper lanterns', len: '2:58' },
  { title: 'Slow Sunday', len: '5:11' },
  { title: 'Streetlight hum', len: '3:27' },
]

const EXTRAS = ['Cover art', 'Subtitles', 'Song names and artist', 'Skip sponsor segments'] as const
const EXTRA_SUMMARY: Record<(typeof EXTRAS)[number], string> = {
  'Cover art': 'cover art',
  Subtitles: 'subtitles',
  'Song names and artist': 'names and artist',
  'Skip sponsor segments': 'sponsors skipped',
}

export function Download() {
  const cardRef = useRef<HTMLDivElement>(null)
  // The link is simply there once the card is in view; the preview below follows it in.
  const done = useInView(cardRef, { once: true, amount: 0.4 })
  const [checks, setChecks] = useState([true, true, false, true, true])
  const [extras, setExtras] = useState<Record<string, boolean>>({ 'Cover art': true, 'Song names and artist': true, 'Skip sponsor segments': true })
  const [mode, setMode] = useState<'Video' | 'Audio'>('Audio')
  const picked = checks.filter(Boolean).length
  const summary = [mode === 'Audio' ? 'MP3' : 'MP4 · up to 4K', `${picked} selected`, ...EXTRAS.filter((e) => extras[e]).map((e) => EXTRA_SUMMARY[e])].join(' · ')
  const show = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: done ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section id="download" className="border-t border-[#161616] px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
        <div ref={cardRef} className="order-2 flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:order-1">
          <div className="flex h-[42px] items-center gap-2.5 rounded-lg border border-input bg-[#0d0d0d] px-3.5 text-[13px] text-muted-foreground">
            {done ? <LinkMark url={`https://${LINK}`} size={15} /> : <Link2 size={15} className="shrink-0" />}
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.3 }} className="truncate font-mono">
              {LINK}
            </motion.span>
          </div>

          <motion.div {...show(0)} className="flex items-center gap-4">
            <div className="relative flex h-[76px] w-[136px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#2a2a2a,#161616)] sm:h-[84px] sm:w-[150px]">
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 font-mono text-[10px]">12 videos</span>
              <Play size={20} className="text-muted-foreground" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold">Lo-fi for late nights</span>
              <span className="flex items-center gap-1.5 truncate text-[13px] text-subtle-foreground">
                <BrandMark site="youtube" size={13} /> YouTube · Quiet Hours · 12 videos · 48:10
              </span>
              <span className="font-mono text-xs text-subtle-foreground">about 64 MB as MP3</span>
            </div>
          </motion.div>

          <motion.div {...show(0.1)} className="flex flex-col overflow-hidden rounded-lg border border-[#1f1f1f]">
            <div className="flex h-9 items-center justify-between border-b border-[#1a1a1a] px-3.5 text-xs text-subtle-foreground">
              <span className="flex items-center gap-2">
                <ListVideo size={14} /> Pick what to keep
              </span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setChecks((c) => c.map(() => !c.every(Boolean)))}
              >
                {checks.every(Boolean) ? 'Clear all' : 'Select all'}
              </button>
            </div>
            {ITEMS.map((it, i) => (
              <motion.label
                key={it.title}
                {...show(0.16 + i * 0.06)}
                className="flex h-[42px] cursor-pointer items-center gap-3 border-b border-[#1a1a1a] px-3.5 text-[13px] last:border-b-0 hover:bg-[#141414]"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#ededed]"
                  checked={checks[i]}
                  onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                />
                <span className="grow truncate">{it.title}</span>
                <span className="font-mono text-xs text-subtle-foreground">{it.len}</span>
              </motion.label>
            ))}
          </motion.div>

          <motion.div {...show(0.44)} className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#1f1f1f] sm:grid-cols-2">
            {EXTRAS.map((e) => (
              <label key={e} className="flex h-[42px] cursor-pointer items-center justify-between gap-3 border-b border-[#1a1a1a] px-3.5 text-[13px] hover:bg-[#141414] last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(2)]:border-b-0">
                <span className="truncate">{e}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(extras[e])}
                  onClick={() => setExtras((x) => ({ ...x, [e]: !x[e] }))}
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                    extras[e] ? 'bg-lime' : 'bg-input',
                  )}
                >
                  <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-background transition-transform duration-200', extras[e] && 'translate-x-4')} />
                </button>
              </label>
            ))}
          </motion.div>

          <motion.div {...show(0.5)} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div role="radiogroup" aria-label="Keep" className="flex rounded-lg border border-input p-0.5 text-xs">
                {(['Video', 'Audio'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'h-7 rounded-md px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      mode === m ? 'bg-secondary text-foreground' : 'text-subtle-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <span className="text-xs text-subtle-foreground">{summary}</span>
            </div>
            <span className="inline-flex h-[38px] items-center rounded-lg bg-lime px-4 text-[13px] font-medium text-lime-foreground">Download {picked} items</span>
          </motion.div>
        </div>

        <div className="order-1 flex flex-col gap-5 lg:order-2">
          <Heading lines={['Paste a link.', 'Keep what you like.']} />
          <Lead>
            Grab one video, a whole playlist or a channel, in sharp 4K or as music for your phone. Tick the ones you want and
            Sparky can turn them into MP3 in the same go.
          </Lead>
        </div>
      </div>
    </section>
  )
}
