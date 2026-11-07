// Job pill of the 2.0 shell: the live job and its progress at a glance, replacing the 1.x queue dock; a click opens the Queue.
import { useApp } from '@/lib/state'

export function JobPill() {
  const { jobs, go } = useApp()
  const running = jobs.filter((j) => j.status === 'running')
  const queued = jobs.filter((j) => j.status === 'queued').length
  const job = running[0]
  const pct = job && job.progress >= 0 ? Math.round(job.progress * 100) : null
  const label = job ? job.title : queued ? `${queued} waiting` : 'Queue idle'
  return (
    <button
      type="button"
      onClick={() => go('queue')}
      className="flex h-6 max-w-96 items-center gap-2 rounded-full border border-[var(--shell-line)] bg-[var(--shell-pill)] px-2.5 font-mono text-[11px] text-foreground backdrop-blur-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={job ? 'sp-running size-1.5 shrink-0 rounded-full bg-lime' : 'size-1.5 shrink-0 rounded-full bg-subtle-foreground'} aria-hidden />
      <span className="truncate">{label}</span>
      {running.length > 1 && <span className="shrink-0 text-subtle-foreground">+{running.length - 1}</span>}
      {pct !== null && (
        <>
          <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-track">
            <span className="block h-full rounded-full bg-lime transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </span>
          <span className="shrink-0">{pct}%</span>
        </>
      )}
    </button>
  )
}
