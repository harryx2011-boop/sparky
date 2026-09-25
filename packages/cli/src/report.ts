// How finished and running jobs are shown: the summary agents and --json get, the lines people read, the progress bar.
import type { Job } from '@sparky/core'

/** What a caller needs from a job; never its args, so a secret can't leave through here. */
export interface JobSummary {
  id: string
  op: string
  status: Job['status']
  source: string
  outputs: string[]
  error?: string
  note?: string
  sizeBefore?: number
  sizeAfter?: number
  /** 0–1 while running, -1 when it can't be measured. Left out once settled. */
  progress?: number
}

export function summarize(j: Job): JobSummary {
  const settled = ['done', 'failed', 'canceled', 'paused'].includes(j.status)
  return {
    id: j.id,
    op: j.op,
    status: j.status,
    source: j.source,
    outputs: j.outputs,
    ...(j.error ? { error: j.error } : {}),
    ...(j.note ? { note: j.note } : {}),
    ...(j.sizeBefore !== undefined ? { sizeBefore: j.sizeBefore } : {}),
    ...(j.sizeAfter !== undefined ? { sizeAfter: j.sizeAfter } : {}),
    ...(settled ? {} : { progress: j.progress }),
  }
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

/** "2 done, 1 failed" */
export function countLine(jobs: readonly Job[]): string {
  const counts = new Map<string, number>()
  for (const j of jobs) counts.set(j.status, (counts.get(j.status) ?? 0) + 1)
  return [...counts].map(([s, n]) => `${n} ${s}`).join(', ')
}

/** One plain line for a set of jobs: what happened and where the results are. */
export function headline(label: string, jobs: readonly Job[]): string {
  if (!jobs.length) return `${label}: nothing to do.`
  const outputs = jobs.flatMap((j) => j.outputs)
  const errors = jobs.filter((j) => j.error).map((j) => j.error!)
  let line = `${label}: ${countLine(jobs)}.`
  if (outputs.length === 1) line += ` Saved ${outputs[0]}`
  else if (outputs.length > 1) line += ` Saved ${outputs.length} files.`
  if (errors.length) line += ` ${errors[0]}`
  return line
}

export function failed(jobs: readonly Job[]): boolean {
  return jobs.some((j) => j.status !== 'done')
}

export interface Bar {
  update(jobs: readonly Job[]): void
  done(): void
}

export const NO_BAR: Bar = { update() {}, done() {} }

/** A one-line bar on a terminal's stderr; nothing at all when stderr is not a terminal. */
export function progressBar(label: string, stream: NodeJS.WriteStream = process.stderr): Bar {
  if (!stream.isTTY) return NO_BAR
  let last = ''
  let at = 0
  const draw = (jobs: readonly Job[], force = false) => {
    const now = Date.now()
    if (!force && now - at < 100) return
    at = now
    const measured = jobs.filter((j) => j.progress >= 0)
    const frac = jobs.length ? jobs.reduce((s, j) => s + (['done', 'failed', 'canceled'].includes(j.status) ? 1 : Math.max(0, j.progress)), 0) / jobs.length : 0
    const width = Math.max(10, Math.min(30, (stream.columns ?? 80) - 50))
    const fill = Math.round(frac * width)
    const settled = jobs.filter((j) => ['done', 'failed', 'canceled', 'paused'].includes(j.status)).length
    const running = jobs.find((j) => j.status === 'running')
    const pct = measured.length || settled ? `${Math.floor(frac * 100)}%`.padStart(4) : ' ...'
    const tail = [jobs.length > 1 ? `${settled}/${jobs.length}` : '', running?.speed ?? '', running?.stage?.label ?? ''].filter(Boolean).join('  ')
    const text = `${label} [${'#'.repeat(fill)}${'-'.repeat(width - fill)}] ${pct} ${tail}`.slice(0, (stream.columns ?? 80) - 1)
    if (text === last) return
    last = text
    stream.write(`\r${text}\x1b[K`)
  }
  return {
    update: (jobs) => draw(jobs),
    done() {
      if (last) stream.write('\r\x1b[K')
    },
  }
}
