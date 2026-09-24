import type { Job } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { CanceledError } from '../src/main/engine/process'
import { JobQueue, type RunContext } from '../src/main/engine/queue'

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms))

/** A runner whose jobs finish only when the test says so. */
function controllable() {
  const pending = new Map<string, { resolve: () => void; reject: (e: unknown) => void; ctx: RunContext }>()
  const runner = (job: Job, ctx: RunContext) =>
    new Promise<void>((resolve, reject) => {
      pending.set(job.id, { resolve, reject, ctx })
      ctx.signal.addEventListener('abort', () => reject(new CanceledError(ctx.signal.reason)))
    })
  return { runner, pending }
}

const add = (q: JobQueue, id: string, kind: Job['kind'] = 'convert') => q.add({ id, kind, title: id, source: id })

describe('JobQueue', () => {
  it('runs no more than the concurrency limit at once', async () => {
    const { runner, pending } = controllable()
    const q = new JobQueue(runner, 2)
    ;['a', 'b', 'c'].forEach((id) => add(q, id))
    await tick()
    expect(q.list().map((j) => j.status)).toEqual(['running', 'running', 'queued'])
    pending.get('a')!.resolve()
    await tick()
    expect(q.list().map((j) => j.status)).toEqual(['done', 'running', 'running'])
  })

  it('records failures with their message', async () => {
    const q = new JobQueue(async () => {
      throw Object.assign(new Error('Broken file'), { suggestUpdate: true })
    }, 1)
    const finished: Job[] = []
    q.on('finished', (j) => finished.push(j))
    add(q, 'a')
    await tick()
    expect(finished[0]).toMatchObject({ status: 'failed', error: 'Broken file', suggestUpdate: true })
  })

  it('pauses, resumes and cancels', async () => {
    const { runner } = controllable()
    const q = new JobQueue(runner, 1)
    add(q, 'a', 'download')
    add(q, 'b')
    await tick()
    q.pause('a')
    await tick()
    expect(q.get('a')!.status).toBe('paused')
    expect(q.get('b')!.status).toBe('running')
    q.cancel('b')
    await tick()
    expect(q.get('b')!.status).toBe('canceled')
    q.resume('a')
    await tick()
    expect(q.get('a')!.status).toBe('running')
  })

  it('reorders waiting jobs and retries failed ones', async () => {
    const { runner, pending } = controllable()
    const q = new JobQueue(runner, 1)
    ;['a', 'b', 'c'].forEach((id) => add(q, id))
    q.reorder(['a', 'c', 'b'])
    await tick()
    pending.get('a')!.reject(new Error('nope'))
    await tick()
    expect(q.get('c')!.status).toBe('running')
    q.retry('a')
    expect(q.get('a')!.status).toBe('queued')
  })

  it('passes progress updates through and clamps concurrency', async () => {
    const { runner, pending } = controllable()
    const q = new JobQueue(runner, 1)
    add(q, 'a')
    await tick()
    pending.get('a')!.ctx.update({ progress: 0.5, speed: '2x' })
    expect(q.get('a')).toMatchObject({ progress: 0.5, speed: '2x' })
    q.setConcurrency(99)
    ;['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].forEach((id) => add(q, id))
    await tick()
    expect(q.activeCount()).toBe(8)
  })
})
