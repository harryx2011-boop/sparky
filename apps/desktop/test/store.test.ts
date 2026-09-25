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
    expect(s.loadSettings('/root').batch).toBe(true)
    expect(s.loadSettings('/root').theme).toBe('dark')
    s.saveSettings({ batch: 'yes' as never, performance: 'turbo' as never, theme: 'sepia' as never, downloadExtras: { thumbnail: false } as never })
    const loaded = s.loadSettings('/root')
    expect(loaded.batch).toBe(true)
    expect(loaded.performance).toBe('normal')
    expect(loaded.theme).toBe('dark')
    expect(loaded.downloadExtras).toMatchObject({ thumbnail: false, metadata: true })
    s.close()
  })

  it('turns an old "jobs at once" number into the batch switch', () => {
    const file = path.join(tmp(), 'db.sqlite')
    const s = new Store(file)
    const legacy = (n: unknown) => s.saveSettings({ concurrency: n } as never)
    legacy(1)
    expect(s.loadSettings('/root').batch).toBe(false)
    legacy(4)
    expect(s.loadSettings('/root').batch).toBe(true)
    legacy('junk')
    expect(s.loadSettings('/root').batch).toBe(true)
    // A saved batch choice wins over the old number.
    legacy(1)
    s.saveSettings({ batch: true })
    expect(s.loadSettings('/root').batch).toBe(true)
    s.saveSettings({ batch: false })
    legacy(8)
    expect(s.loadSettings('/root').batch).toBe(false)
    // A saved theme is kept; only the default moved to dark.
    s.saveSettings({ theme: 'light' })
    expect(s.loadSettings('/root').theme).toBe('light')
    s.close()
  })
})

describe('Store search', () => {
  it('finds titles with quotes, brackets, backslashes and unicode', () => {
    const s = new Store(path.join(tmp(), 'db.sqlite'))
    const base = { kind: 'convert' as const, outputs: [], progress: 1, createdAt: 1, finishedAt: 2, status: 'done' as const }
    s.record({ ...base, id: '1', title: "Harry's clip [final] → MP4", source: "C:\\Videos\\Harry's clip [final].mov" })
    s.record({ ...base, id: '2', title: '日本語 "quoted" 50%_off.wav → MP3', source: 'D:\\音楽\\50%_off.wav' })
    s.record({ ...base, id: '3', title: 'plain.mov → MP4', source: '/a/plain.mov' })
    expect(s.search({ text: "Harry's" }).map((h) => h.id)).toEqual(['1'])
    expect(s.search({ text: '[final]' }).map((h) => h.id)).toEqual(['1'])
    expect(s.search({ text: 'C:\\Videos' }).map((h) => h.id)).toEqual(['1'])
    expect(s.search({ text: '"quoted"' }).map((h) => h.id)).toEqual(['2'])
    expect(s.search({ text: '日本語' }).map((h) => h.id)).toEqual(['2'])
    expect(s.search({ text: '%_off' }).map((h) => h.id)).toEqual(['2'])
    expect(s.search({ text: '_' }).map((h) => h.id)).toEqual(['2'])
    expect(s.search({ text: '   ' }).length).toBe(3)
    s.close()
  })
})
