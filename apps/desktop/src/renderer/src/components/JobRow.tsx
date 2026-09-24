import { describeSaving, formatDuration, type Job } from '@sparky/core'
import { cn } from '@sparky/ui'
import { AlertCircle, ArrowLeftRight, Check, Download, FolderOpen, GripVertical, Pause, Play, RotateCcw, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Tip } from './ui/tooltip'

export function statusText(job: Job): string {
  switch (job.status) {
    case 'queued':
      return 'Waiting'
    case 'paused':
      return job.kind === 'convert' ? 'Paused · starts over when resumed' : 'Paused'
    case 'canceled':
      return 'Canceled'
    case 'failed':
      return job.error ?? 'Failed'
    case 'done':
      return describeSaving(job.sizeBefore, job.sizeAfter) ?? (job.outputs.length > 1 ? `${job.outputs.length} files` : 'Done')
    case 'running': {
      const parts = [job.stage && job.stage.count > 1 ? `${job.stage.index}/${job.stage.count} ${job.stage.label}` : job.stage?.label, job.speed, job.eta !== undefined ? `${formatDuration(job.eta)} left` : undefined]
      return parts.filter(Boolean).join(' · ') || (job.progress >= 0 ? `${Math.round(job.progress * 100)}%` : 'Working…')
    }
  }
}

/** One job with its progress and controls. `compact` is the dock layout. */
export function JobRow({ job, compact, draggable, onUpdate }: { job: Job; compact?: boolean; draggable?: boolean; onUpdate?: () => void }) {
  const Icon = job.kind === 'download' ? Download : ArrowLeftRight
  const running = job.status === 'running'
  const act = (fn: (id: string) => Promise<void>) => () => void fn(job.id).then(onUpdate)
  const tone = job.status === 'done' ? 'success' : job.status === 'failed' ? 'error' : job.status === 'canceled' ? 'muted' : 'default'
  const progress = job.status === 'done' ? 1 : job.progress
  const text = statusText(job)

  const controls = (
    <div className="flex shrink-0 items-center gap-0.5">
      {running && (
        <Tip content="Pause">
          <Button size="icon-sm" variant="ghost" aria-label="Pause" onClick={act(api.queue.pause)}>
            <Pause size={13} />
          </Button>
        </Tip>
      )}
      {job.status === 'queued' && (
        <Tip content="Hold">
          <Button size="icon-sm" variant="ghost" aria-label="Hold" onClick={act(api.queue.pause)}>
            <Pause size={13} />
          </Button>
        </Tip>
      )}
      {job.status === 'paused' && (
        <Tip content="Resume">
          <Button size="icon-sm" variant="ghost" aria-label="Resume" onClick={act(api.queue.resume)}>
            <Play size={13} />
          </Button>
        </Tip>
      )}
      {(job.status === 'failed' || job.status === 'canceled') && (
        <Tip content="Try again">
          <Button size="icon-sm" variant="ghost" aria-label="Try again" onClick={act(api.queue.retry)}>
            <RotateCcw size={13} />
          </Button>
        </Tip>
      )}
      {job.status === 'done' && job.outputs[0] && (
        <Tip content="Show in folder">
          <Button size="icon-sm" variant="ghost" aria-label="Show in folder" onClick={() => void api.files.showInFolder(job.outputs[0]!)}>
            <FolderOpen size={13} />
          </Button>
        </Tip>
      )}
      {running || job.status === 'queued' || job.status === 'paused' ? (
        <Tip content="Cancel">
          <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={act(api.queue.cancel)}>
            <X size={14} />
          </Button>
        </Tip>
      ) : (
        <Tip content="Remove from list">
          <Button size="icon-sm" variant="ghost" aria-label="Remove from list" onClick={act(api.queue.remove)}>
            <X size={14} />
          </Button>
        </Tip>
      )}
    </div>
  )

  if (compact) {
    return (
      <div className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,220px)_auto] items-center gap-4 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={12} className="shrink-0 text-subtle-foreground" />
          <span className="truncate">{job.title}</span>
        </span>
        <Progress value={progress} running={running} tone={tone} />
        <span className={cn('truncate text-right font-mono text-[11px]', job.status === 'failed' ? 'text-destructive' : 'text-subtle-foreground')} title={text}>
          {text}
        </span>
        {controls}
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      {draggable ? <GripVertical size={14} className="shrink-0 cursor-grab text-subtle-foreground/50 group-hover:text-subtle-foreground" /> : <span className="w-3.5" />}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {job.status === 'done' ? <Check size={14} className="text-success" /> : job.status === 'failed' ? <AlertCircle size={14} className="text-destructive" /> : <Icon size={14} />}
      </span>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[13px] font-medium">{job.title}</span>
          <span className={cn('shrink-0 truncate font-mono text-[11px]', job.status === 'failed' ? 'text-destructive' : 'text-subtle-foreground')}>
            {running && job.progress >= 0 ? `${Math.round(job.progress * 100)}%` : ''}
          </span>
        </div>
        <Progress value={progress} running={running} tone={tone} />
        <span className={cn('truncate text-xs', job.status === 'failed' ? 'text-destructive' : 'text-subtle-foreground')} title={text}>
          {text}
          {job.note && job.status !== 'failed' ? ` · ${job.note}` : ''}
        </span>
      </div>
      {controls}
    </div>
  )
}
