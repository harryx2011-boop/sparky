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

/** A job before the queue gives it an id and a status. `op` defaults to the kind, the way rows from before ops read back. */
export type NewJob = Omit<Job, 'id' | 'status' | 'progress' | 'outputs' | 'createdAt' | 'op'> & Partial<Pick<Job, 'id' | 'op'>>

const SETTLED = new Set<Job['status']>(['done', 'failed', 'canceled', 'paused'])

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
  private settled = new Map<string, Promise<void>>()
  /** Cancel pressed while a pause was still stopping the process. */
  private cancelAfterStop = new Set<string>()
  /** Resume pressed while a pause was still stopping the process: go straight back to the line. */
  private resumeAfterStop = new Set<string>()
  /** Callers waiting for a job to stop (done, failed, canceled or paused). */
  private waiters = new Map<string, ((job: Job | undefined) => void)[]>()
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
    const job: Job = { ...input, op: input.op ?? input.kind, id: input.id ?? randomUUID(), status: 'queued', progress: 0, outputs: [], createdAt: Date.now() }
    this.jobs.push(job)
    this.changed(true)
    this.pump()
    return { ...job }
  }

  pause(id: string): void {
    const job = this.get(id)
    if (!job) return
    if (job.status === 'running') {
      // The last press wins: a Pause after a Resume-while-stopping keeps it paused.
      this.resumeAfterStop.delete(id)
      this.running.get(id)?.abort('pause')
    } else if (job.status === 'queued') this.patch(job, { status: 'paused' })
  }

  resume(id: string): void {
    const job = this.get(id)
    if (!job) return
    if (job.status === 'paused') {
      this.patch(job, { status: 'queued', speed: undefined, eta: undefined })
      this.pump()
    } else if (job.status === 'running' && this.stoppingForPause(id)) {
      this.resumeAfterStop.add(id)
    }
  }

  pauseAll(): void {
    for (const j of this.jobs) if (j.status === 'running' || j.status === 'queued') this.pause(j.id)
  }

  resumeAll(): void {
    for (const j of this.jobs) {
      if (j.status === 'paused') this.patch(j, { status: 'queued', speed: undefined, eta: undefined })
      else if (j.status === 'running' && this.stoppingForPause(j.id)) this.resumeAfterStop.add(j.id)
    }
    this.pump()
  }

  private stoppingForPause(id: string): boolean {
    const c = this.running.get(id)
    return Boolean(c?.signal.aborted && c.signal.reason === 'pause')
  }

  cancel(id: string): void {
    const job = this.get(id)
    if (!job) return
    if (job.status === 'running') {
      const c = this.running.get(id)
      this.resumeAfterStop.delete(id)
      if (c?.signal.aborted) this.cancelAfterStop.add(id)
      else c?.abort('cancel')
    } else if (job.status === 'queued' || job.status === 'paused') {
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
    this.settle(job)
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

  /** Resolves with the job the next time it stops: done, failed, canceled or paused (or removed). Unknown ids resolve undefined. */
  whenSettled(id: string): Promise<Job | undefined> {
    const job = this.get(id)
    if (!job || SETTLED.has(job.status)) return Promise.resolve(job && { ...job })
    return new Promise((resolve) => this.waiters.set(id, [...(this.waiters.get(id) ?? []), resolve]))
  }

  private settle(job: Job): void {
    const list = this.waiters.get(job.id)
    if (!list) return
    this.waiters.delete(job.id)
    for (const resolve of list) resolve({ ...job })
  }

  activeCount(): number {
    return this.running.size
  }

  /** Stops everything and waits (up to `timeoutMs`) for jobs to clean up their partial files. */
  async shutdown(timeoutMs = 3000): Promise<void> {
    for (const c of this.running.values()) c.abort('cancel')
    const all = Promise.allSettled([...this.settled.values()])
    await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))])
  }

  private pump(): void {
    while (this.running.size < this.concurrency) {
      const next = this.jobs.find((j) => j.status === 'queued')
      if (!next) break
      const p = this.start(next)
      this.settled.set(next.id, p)
      void p.finally(() => this.settled.delete(next.id))
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
        const paused = controller.signal.reason === 'pause' && !this.cancelAfterStop.has(job.id)
        const requeue = paused && this.resumeAfterStop.has(job.id)
        this.cancelAfterStop.delete(job.id)
        this.resumeAfterStop.delete(job.id)
        this.patch(job, {
          status: requeue ? 'queued' : paused ? 'paused' : 'canceled',
          speed: undefined,
          eta: undefined,
          finishedAt: paused ? undefined : Date.now(),
          ...(paused && job.restartsOnResume ? { progress: 0 } : {}),
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
    if (SETTLED.has(job.status)) this.settle(job)
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
