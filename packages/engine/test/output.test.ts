import { defaultSettings } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { freeName, planOutput, samePath, splitOut } from '../src/output'

const dirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-output-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`still waiting after ${ms} ms`)), ms))])

describe('splitOut', () => {
  it('reads a folder from an existing folder, a trailing separator or a missing extension', () => {
    const dir = tmp()
    expect(splitOut(dir)).toEqual({ dir })
    expect(splitOut(path.join(dir, 'new', ''))).toEqual({ dir: path.join(dir, 'new') })
    expect(splitOut(path.join(dir, 'Converted'))).toEqual({ dir: path.join(dir, 'Converted') })
    expect(splitOut(path.join(dir, 'clip.mp4'))).toEqual({ dir, file: path.join(dir, 'clip.mp4') })
  })

  it('reads a missing folder with a dot in its name as a file (documented: end it with a separator)', () => {
    const dir = tmp()
    expect(splitOut(path.join(dir, 'v1.2'))).toEqual({ dir, file: path.join(dir, 'v1.2') })
    fs.mkdirSync(path.join(dir, 'v1.2'))
    expect(splitOut(path.join(dir, 'v1.2'))).toEqual({ dir: path.join(dir, 'v1.2') })
  })
})

describe('planOutput', () => {
  const settings = (root: string) => () => defaultSettings(root)

  it('goes to the output root’s category folder, beside the source for replace, or to out', async () => {
    const root = tmp()
    const src = path.join(tmp(), 'clip.mov')
    fs.writeFileSync(src, 'x')
    expect((await planOutput(settings(root), { input: src, ext: 'mp4', category: 'video' })).dir).toBe(path.join(root, 'Video'))
    expect((await planOutput(settings(root), { input: src, ext: 'mp4', category: 'video', replace: true })).dir).toBe(path.dirname(src))
    const out = path.join(tmp(), 'picked', 'final.mp4')
    const plan = await planOutput(settings(root), { input: src, ext: 'mp4', category: 'video', replace: true, out })
    expect(plan.dir).toBe(path.dirname(out))
    expect(await plan.claimFinal()).toBe(out)
  })

  it('reserves a name on disk and gives it back on release', async () => {
    const root = tmp()
    const plan = await planOutput(settings(root), { input: 'C:/in/clip.mov', ext: 'mp4', category: 'video' })
    const final = await plan.claimFinal()
    expect(path.basename(final)).toBe('clip.mp4')
    expect(fs.existsSync(final)).toBe(true)
    const other = await planOutput(settings(root), { input: 'C:/in/clip.mov', ext: 'mp4', category: 'video' })
    expect(path.basename(await other.claimFinal())).toBe('clip (2).mp4')
    await plan.release()
    expect(fs.existsSync(final)).toBe(false)
  })

  it('treats names that differ only in case as taken on Windows', async () => {
    const root = tmp()
    const dir = path.join(root, 'Video')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'Clip.mp4'), 'x')
    const plan = await planOutput(settings(root), { input: 'C:/in/clip.mov', ext: 'mp4', category: 'video' })
    const final = await within(plan.claimFinal(), 2000)
    expect(path.basename(final)).toBe(process.platform === 'win32' ? 'clip (2).mp4' : 'clip.mp4')
  })

  it('never offers a name it was told is taken', async () => {
    const dir = tmp()
    expect(await freeName(dir, 'clip.mov', 'mp4', '', new Set(['clip.mp4']))).toBe('clip (2).mp4')
  })
})

describe('samePath', () => {
  it('compares resolved paths, ignoring case on Windows', () => {
    expect(samePath('a/../b.txt', 'b.txt')).toBe(true)
    expect(samePath('B.TXT', 'b.txt')).toBe(process.platform === 'win32')
    expect(samePath(undefined, 'b.txt')).toBe(false)
  })
})
