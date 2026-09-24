// One shared queue for conversions and downloads.
import { CONCURRENCY_MAX, CONCURRENCY_MIN, type Job } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { CanceledError } from './process'

export interface RunContext {
  signal: AbortSignal
  /** Merge progress, speed, stage and so on into the job. */
  update(patch: Partial<Job>): void
}

export type Runner = (job: Job, ctx: RunContext) => Promise<Partial<Job> | void>

export type NewJob = Omit<Job, 'id' | 'status' | 'progress' | 'outputs' | 'createdAt'> & Partial<Pick<Job, 'id'>>

interface QueueEvents {
  change: [jobs: Job[]]
  finished: [job: Job]
}

/**
 * Runs up to `concurrency` jobs at once.
 * Pausing a running job stops its process; downloads pick up where they left off,
 * conversions start again from the beginning when resumed.
 */
export class JobQueue extends EventEmitter<QueueEvents> {
  private jobs: Job[] = []
  private running = new Map<string, AbortController>()
  private emitTimer: NodeJS.Timeout | undefined
  private lastEmit = 0

  constructor(
    private runner: Runner,
    private concurrency = 2,
  ) {
    super()
  }

  list(): Job[] {
    return this.jobs.map((j) => ({ ...j }))
  }

  get(id: string): Job | undefined {
    return this.jobs.find((j) => j.id === id)
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(CONCURRENCY_MIN, Math.min(CONCURRENCY_MAX, Math.round(n)))
    this.pump()
  }

  add(input: NewJob): Job {
    const job: Job = { ...input, id: input.id ?? randomUUID(), status: 'queued', progress: 0, outputs: [], createdAt: Date.now() }
    this.jobs.push(job)
    this.changed(true)
    this.pump()
    return { ...job }
  }

  pause(id: string): void {
    const job = this.get(id)
    if (!job) return
    if (job.status === 'running') this.running.get(id)?.abort('pause')
    else if (job.status === 'queued') this.patch(job, { status: 'paused' })
  }

  resume(id: string): void {
    const job = this.get(id)
    if (job?.status === 'paused') {
      this.patch(job, { status: 'queued', speed: undefined, eta: undefined })
      this.pump()
    }
  }

  pauseAll(): void {
    for (const j of this.jobs) if (j.status === 'running' || j.status === 'queued') this.pause(j.id)
  }

  resumeAll(): void {
    for (const j of this.jobs) if (j.status === 'paused') this.patch(j, { status: 'queued', speed: undefined, eta: undefined })
    this.pump()
  }

  cancel(id: string): void {
    const job = this.get(id)
    if (!job) return
    if (job.status === 'running') this.running.get(id)?.abort('cancel')
    else if (job.status === 'queued' || job.status === 'paused') {
      this.patch(job, { status: 'canceled', finishedAt: Date.now() })
      this.emit('finished', { ...job })
    }
  }

  retry(id: string): void {
    const job = this.get(id)
    if (!job || (job.status !== 'failed' && job.status !== 'canceled')) return
    this.patch(job, { status: 'queued', progress: 0, error: undefined, suggestUpdate: undefined, speed: undefined, eta: undefined, stage: undefined, note: undefined, finishedAt: undefined })
    this.pump()
  }

  remove(id: string): void {
    const job = this.get(id)
    if (!job || job.status === 'running') return
    this.jobs = this.jobs.filter((j) => j.id !== id)
    this.changed(true)
  }

  clearFinished(): void {
    this.jobs = this.jobs.filter((j) => j.status === 'queued' || j.status === 'running' || j.status === 'paused')
    this.changed(true)
  }

  /** Reorders jobs to match `ids`. Jobs not listed keep their relative order at the end. */
  reorder(ids: string[]): void {
    const pos = new Map(ids.map((id, i) => [id, i]))
    this.jobs = [...this.jobs].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity))
    this.changed(true)
  }

  activeCount(): number {
    return this.running.size
  }

  /** Stops everything, e.g. when the app quits. */
  shutdown(): void {
    for (const c of this.running.values()) c.abort('cancel')
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const next = this.jobs.find((j) => j.status === 'queued')
      if (!next) break
      void this.start(next)
    }
  }

  private async start(job: Job): Promise<void> {
    const controller = new AbortController()
    this.running.set(job.id, controller)
    this.patch(job, { status: 'running', startedAt: Date.now(), error: undefined })
    const ctx: RunContext = {
      signal: controller.signal,
      update: (p) => {
        if (job.status !== 'running') return
        Object.assign(job, p)
        this.changed(false)
      },
    }
    try {
      const result = await this.runner({ ...job }, ctx)
      this.patch(job, { ...result, status: 'done', progress: 1, speed: undefined, eta: undefined, finishedAt: Date.now() })
    } catch (e) {
      if (e instanceof CanceledError || controller.signal.aborted) {
        const paused = controller.signal.reason === 'pause'
        this.patch(job, {
          status: paused ? 'paused' : 'canceled',
          speed: undefined,
          eta: undefined,
          finishedAt: paused ? undefined : Date.now(),
          ...(paused && job.kind === 'convert' ? { progress: 0 } : {}),
        })
      } else {
        const err = e as Error & { suggestUpdate?: boolean }
        this.patch(job, { status: 'failed', error: err.message || String(e), suggestUpdate: err.suggestUpdate, speed: undefined, eta: undefined, finishedAt: Date.now() })
      }
    } finally {
      this.running.delete(job.id)
      if (job.status === 'done' || job.status === 'failed' || job.status === 'canceled') this.emit('finished', { ...job })
      this.pump()
    }
  }

  private patch(job: Job, p: Partial<Job>): void {
    Object.assign(job, p)
    this.changed(true)
  }

  /** Progress updates are throttled to ~10 per second; status changes go out right away. */
  private changed(immediate: boolean): void {
    const now = Date.now()
    if (immediate || now - this.lastEmit > 100) {
      if (this.emitTimer) clearTimeout(this.emitTimer)
      this.emitTimer = undefined
      this.lastEmit = now
      this.emit('change', this.list())
    } else if (!this.emitTimer) {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = undefined
        this.lastEmit = Date.now()
        this.emit('change', this.list())
      }, 100)
    }
  }
}
