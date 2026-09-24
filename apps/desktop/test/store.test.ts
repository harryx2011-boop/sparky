import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Store } from '../src/main/engine/store'

const dirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-store-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

describe('Store', () => {
  it('saves and searches history', () => {
    const s = new Store(path.join(tmp(), 'db.sqlite'))
    const base = { kind: 'convert' as const, source: '/a/clip.mov', outputs: ['/out/clip.mp4'], progress: 1, createdAt: 1, startedAt: 10, finishedAt: 60 }
    s.record({ ...base, id: '1', title: 'clip.mov → MP4', status: 'done', convert: { output: 'mp4', compression: 2, resolution: null, performance: 'max', originals: 'keep', advanced: {} } })
    s.record({ ...base, id: '2', title: '100%_real.wav → MP3', status: 'failed', error: 'x', finishedAt: 70 })
    s.record({ ...base, id: '3', title: 'running', status: 'running' })
    expect(s.search().map((h) => h.id)).toEqual(['2', '1'])
    expect(s.search({ text: 'clip' }).length).toBe(2)
    expect(s.search({ text: '100%' }).map((h) => h.id)).toEqual(['2'])
    expect(s.search({ status: 'done' })[0]).toMatchObject({ id: '1', durationMs: 50, convert: { performance: 'max' } })
    s.remove('1')
    expect(s.get('1')).toBeUndefined()
    s.clear()
    expect(s.search()).toEqual([])
    s.close()
  })

  it('keeps settings within their allowed ranges', () => {
    const file = path.join(tmp(), 'db.sqlite')
    const s = new Store(file)
    expect(s.loadSettings('/root').concurrency).toBe(2)
    s.saveSettings({ concurrency: 42, performance: 'turbo' as never, downloadExtras: { thumbnail: false } as never })
    const loaded = s.loadSettings('/root')
    expect(loaded.concurrency).toBe(8)
    expect(loaded.performance).toBe('normal')
    expect(loaded.downloadExtras).toMatchObject({ thumbnail: false, metadata: true })
    s.close()
  })
})
