import { CONCURRENCY_MAX, CONCURRENCY_MIN, type Job } from '@sparky/core'
import { cn } from '@sparky/ui'
import { Loader2, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Card, PageHeader } from '@/components/Controls'
import { JobRow } from '@/components/JobRow'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

export function QueuePage() {
  const { jobs, settings, updateSettings } = useApp()
  const [dragId, setDragId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'paused')
  const finished = jobs.filter((j) => !active.includes(j))
  const running = jobs.filter((j) => j.status === 'running').length
  const needsUpdate = jobs.some((j) => j.status === 'failed' && j.suggestUpdate)

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = jobs.map((j) => j.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    void api.queue.reorder(ids)
    setDragId(null)
  }

  const section = (title: string, list: Job[], reorderable: boolean) => (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
        {title} · {list.length}
      </span>
      <Card className="overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((j) => {
            const canDrag = reorderable && j.status !== 'running'
            return (
              <motion.div
                key={j.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                draggable={canDrag}
                onDragStart={() => setDragId(j.id)}
                onDragOver={(e) => canDrag && e.preventDefault()}
                onDrop={() => drop(j.id)}
                onDragEnd={() => setDragId(null)}
                className={cn('border-b last:border-b-0', dragId === j.id && 'opacity-40')}
              >
                <JobRow job={j} draggable={canDrag} />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </Card>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Queue" meta={`${running} running · ${settings?.concurrency ?? 2} at once`}>
        <div className="flex items-center gap-1.5 text-xs text-subtle-foreground">
          At once
          <div className="flex rounded-lg border border-input p-0.5">
            {Array.from({ length: CONCURRENCY_MAX - CONCURRENCY_MIN + 1 }, (_, i) => i + CONCURRENCY_MIN).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={settings?.concurrency === n}
                onClick={() => void updateSettings({ concurrency: n })}
                className={cn('size-6 rounded-md font-mono text-[11px]', settings?.concurrency === n ? 'bg-secondary text-foreground' : 'hover:text-foreground')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {active.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => void (running ? api.queue.pauseAll() : api.queue.resumeAll())}>
            {running ? <Pause size={13} /> : <Play size={13} />}
            {running ? 'Pause all' : 'Resume all'}
          </Button>
        )}
        {finished.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => void api.queue.clearFinished()}>
            <Trash2 size={13} /> Clear finished
          </Button>
        )}
      </PageHeader>

      {needsUpdate && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
          <span>Some downloads failed in a way that updating the downloader often fixes.</span>
          <Button
            size="sm"
            disabled={updating}
            onClick={async () => {
              setUpdating(true)
              const res = await api.tools.updateYtDlp()
              setUpdating(false)
              if (res.ok) toast.success(res.message)
              else toast.error(res.message)
            }}
          >
            {updating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Update downloader
          </Button>
        </Card>
      )}

      {jobs.length === 0 && (
        <Card className="px-6 py-12 text-center text-[13px] text-subtle-foreground">The queue is empty. Conversions and downloads you start will line up here.</Card>
      )}
      {active.length > 0 && section('In progress', active, true)}
      {finished.length > 0 && section('Finished', finished, false)}
      {active.length > 1 && <p className="text-xs text-subtle-foreground">Drag waiting jobs to change their order. Paused conversions start over when resumed; downloads pick up where they left off.</p>}
    </div>
  )
}
