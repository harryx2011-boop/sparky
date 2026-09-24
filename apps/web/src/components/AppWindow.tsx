import { compressionInfo, performanceInfo, resolutionLabel } from '@sparky/core'
import { Bolt, CompressionSlider, DiscordIcon, GmailIcon, PerformanceBars, CONTACT } from '@sparky/ui'
import { ArrowLeftRight, ChevronDown, ChevronRight, Download, History, List, Search, SlidersHorizontal, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDemo } from '../state'

const W = 1200
const H = 740

/** Scales a fixed-size design down to fit narrow screens without reflowing it. */
function FitToWidth({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry?.contentRect.width ?? W) / W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="w-full" style={{ height: H * scale }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

function NavItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span className={`flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] ${active ? 'bg-[#1a1a1a] text-foreground' : 'text-muted-foreground'}`}>
      {icon}
      {label}
    </span>
  )
}

const FILES = [
  ['trip-recap.mov', 'MOV · 318 MB'],
  ['interview.wav', 'WAV · 86 MB'],
  ['notes.md', 'MD · 8 KB'],
] as const

/** A faithful, lightly interactive picture of the Sparky app. */
export function AppWindow() {
  const { level, compression, setCompression, effectiveResolution } = useDemo()
  const comp = compressionInfo(compression)
  return (
    <FitToWidth>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0e0e0e] text-left shadow-[0_40px_120px_rgba(0,0,0,.6)]">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1c1c1c] pl-4 text-xs text-subtle-foreground">
          <span className="flex items-center gap-2">
            <Bolt size={13} className="text-foreground" />
            Sparky
          </span>
          <span className="flex h-10" aria-hidden>
            {['—', '▢', '✕'].map((c) => (
              <span key={c} className="flex w-[46px] items-center justify-center">
                {c}
              </span>
            ))}
          </span>
        </div>

        <div className="flex min-h-0 grow">
          <aside className="flex w-[200px] shrink-0 flex-col gap-0.5 border-r border-[#1c1c1c] px-2.5 py-3.5">
            <NavItem active icon={<ArrowLeftRight size={15} />} label="Convert" />
            <NavItem icon={<Download size={15} />} label="Download" />
            <NavItem icon={<List size={15} />} label="Queue" />
            <NavItem icon={<History size={15} />} label="History" />
            <NavItem icon={<SlidersHorizontal size={15} />} label="Settings" />
          </aside>

          <main className="flex grow flex-col gap-4 px-7 py-6">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Convert</span>
              <span className="font-mono text-xs text-subtle-foreground">3 files · 412 MB</span>
            </div>
            <div className="flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2e2e2e] text-[13px] text-subtle-foreground">
              <Upload size={20} />
              Drop files here, or browse
            </div>
            <div className="flex flex-col rounded-[10px] border border-[#1f1f1f]">
              {FILES.map(([name, meta], i) => (
                <div key={name} className={`flex h-11 items-center justify-between px-3.5 text-[13px] ${i < FILES.length - 1 ? 'border-b border-[#1f1f1f]' : ''}`}>
                  <span>{name}</span>
                  <span className="font-mono text-xs text-subtle-foreground">{meta}</span>
                </div>
              ))}
            </div>
            <div className="flex items-stretch gap-3">
              <Field label="Output format" className="grow">
                <span className="flex items-center gap-2">
                  <Search size={14} className="text-subtle-foreground" />
                  MP4 · {comp.label}
                </span>
                <ChevronDown size={14} className="text-subtle-foreground" />
              </Field>
              <Field label="Performance" className="w-[250px]">
                <span className="flex items-center gap-2">
                  <Bolt size={14} strokeWidth={2} />
                  {performanceInfo(level).label}
                </span>
                <PerformanceBars level={level} running />
              </Field>
            </div>
            <div className="flex items-end gap-3">
              <Field label="Resolution" className="w-[250px]">
                <span>{effectiveResolution ? resolutionLabel(effectiveResolution) : 'Original'}</span>
                <span className="font-mono text-[11px] text-subtle-foreground">{level === 'max' ? 'Graphics card ✓' : '4K needs Max'}</span>
              </Field>
              <div className="grow pb-0.5">
                <CompressionSlider value={compression} onChange={setCompression} showStops={false} detail={comp.hint} />
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-subtle-foreground">
                <ChevronRight size={13} /> More options: trim, size, sound quality
              </span>
              <span className="inline-flex h-[38px] items-center rounded-[10px] bg-primary px-4 text-[13px] font-medium text-primary-foreground">Convert 3 files</span>
            </div>
          </main>
        </div>

        <div className="flex h-[118px] shrink-0 flex-col gap-2.5 border-t border-[#1c1c1c] bg-[#0b0b0b] px-5 py-3">
          <div className="flex justify-between text-[11px] text-subtle-foreground">
            <span className="eyebrow !text-[10px]">Queue · 2 running</span>
            <span>Pause all</span>
          </div>
          <QueueRow name="trip-recap.mov → MP4" width={64} meta="3.1x · 0:42 left" />
          <QueueRow name="Lo-fi mix (playlist 4/12)" width={28} meta="6.4 MB/s · 1:15" />
        </div>

        <div className="flex h-[34px] shrink-0 items-center justify-end gap-[18px] border-t border-[#1c1c1c] px-5 text-[11px] text-subtle-foreground">
          <span className="flex items-center gap-1.5">
            <GmailIcon size={12} className="text-foreground" />
            {CONTACT.email}
          </span>
          <span className="flex items-center gap-1.5">
            <DiscordIcon size={12} className="text-foreground" />
            {CONTACT.discord}
          </span>
        </div>
      </div>
    </FitToWidth>
  )
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-[11px] text-subtle-foreground">{label}</span>
      <span className="flex h-[38px] items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#121212] px-3 text-[13px]">{children}</span>
    </div>
  )
}

function QueueRow({ name, width, meta }: { name: string; width: number; meta: string }) {
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)_160px] items-center gap-4 text-xs">
      <span className="truncate">{name}</span>
      <div className="h-1 overflow-hidden rounded bg-track">
        <div className="sp-shimmer h-full rounded" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right font-mono text-subtle-foreground">{meta}</span>
    </div>
  )
}
