import { cn } from '@sparky/ui'
import { Pause, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'
import { JobRow } from './JobRow'

/** The live queue, always visible at the bottom. Drag its top edge to resize. */
export function QueueDock() {
  const { jobs, settings, updateSettings, go } = useApp()
  const height = settings?.dockHeight ?? 168
  const drag = useRef<{ y: number; h: number } | null>(null)
  const running = jobs.filter((j) => j.status === 'running').length
  const paused = jobs.filter((j) => j.status === 'paused').length
  // Newest active work first, then recently finished.
  const order = { running: 0, queued: 1, paused: 2, failed: 3, done: 4, canceled: 5 } as const
  const shown = [...jobs].sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt)

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, h: height }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const h = Math.max(96, Math.min(window.innerHeight * 0.6, drag.current.h + drag.current.y - e.clientY))
    document.documentElement.style.setProperty('--dock-h', `${h}px`)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    const h = Math.max(96, Math.min(window.innerHeight * 0.6, drag.current.h + drag.current.y - e.clientY))
    drag.current = null
    void updateSettings({ dockHeight: Math.round(h) })
  }

  return (
    <section aria-label="Queue" className="relative flex shrink-0 flex-col border-t bg-[color-mix(in_oklab,var(--background)_92%,var(--foreground)_2%)]" style={{ height: `var(--dock-h, ${height}px)` }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize queue"
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="flex h-9 shrink-0 items-center justify-between px-5">
        <button type="button" onClick={() => go('queue')} className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground hover:text-foreground">
          Queue · {running ? `${running} running` : jobs.length ? 'idle' : 'empty'}
        </button>
        {(running > 0 || paused > 0) && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-[11px] text-subtle-foreground hover:text-foreground"
            onClick={() => void (running > 0 ? api.queue.pauseAll() : api.queue.resumeAll())}
          >
            {running > 0 ? <Pause size={11} /> : <Play size={11} />}
            {running > 0 ? 'Pause all' : 'Resume all'}
          </button>
        )}
      </div>
      <div className={cn('flex min-h-0 grow flex-col gap-2 overflow-y-auto px-5 pb-3', !jobs.length && 'items-center justify-center')}>
        {!jobs.length && <span className="text-xs text-subtle-foreground">Jobs you start show up here with their speed and time left.</span>}
        <AnimatePresence initial={false}>
          {shown.map((j) => (
            <motion.div key={j.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              <JobRow job={j} compact />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
