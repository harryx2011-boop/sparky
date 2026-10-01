import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyInto, copyTo, uniqueName } from './save'

let dir: string
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sparky-save-'))
})
afterEach(async () => {
  await fsp.rm(dir, { recursive: true, force: true })
})

describe('uniqueName', () => {
  it('keeps a free name and numbers a taken one, ignoring case', () => {
    expect(uniqueName('a.mp4', new Set())).toBe('a.mp4')
    expect(uniqueName('a.mp4', new Set(['a.mp4']))).toBe('a (2).mp4')
    expect(uniqueName('A.MP4', new Set(['a.mp4', 'a (2).mp4']))).toBe('A (3).MP4')
  })
})

describe('copyInto', () => {
  it('copies every file, numbers duplicates and leaves existing files alone', async () => {
    const src = path.join(dir, 'src')
    const out = path.join(dir, 'out')
    await fsp.mkdir(path.join(src, 'x'), { recursive: true })
    await fsp.mkdir(out)
    await fsp.writeFile(path.join(src, 'a.txt'), 'new a')
    await fsp.writeFile(path.join(src, 'x', 'a.txt'), 'second a')
    await fsp.writeFile(path.join(out, 'a.txt'), 'old a')
    const res = await copyInto(out, [path.join(src, 'a.txt'), path.join(src, 'x', 'a.txt'), path.join(src, 'missing.txt')])
    expect(res.failed).toEqual([path.join(src, 'missing.txt')])
    expect(res.saved.map((p) => path.basename(p))).toEqual(['a (2).txt', 'a (3).txt'])
    expect(await fsp.readFile(path.join(out, 'a.txt'), 'utf8')).toBe('old a')
    expect(await fsp.readFile(path.join(out, 'a (2).txt'), 'utf8')).toBe('new a')
  })

  it('creates the folder when it does not exist', async () => {
    const f = path.join(dir, 'f.bin')
    await fsp.writeFile(f, 'x')
    const res = await copyInto(path.join(dir, 'made', 'deep'), [f])
    expect(res.saved).toHaveLength(1)
  })
})

describe('copyTo', () => {
  it('writes the chosen path, treats saving onto itself as done, reports a missing source', async () => {
    const f = path.join(dir, 'f.txt')
    await fsp.writeFile(f, 'x')
    expect(await copyTo(path.join(dir, 'g.txt'), f)).toBe(true)
    expect(await fsp.readFile(path.join(dir, 'g.txt'), 'utf8')).toBe('x')
    expect(await copyTo(f.toUpperCase(), f)).toBe(true)
    expect(await copyTo(path.join(dir, 'h.txt'), path.join(dir, 'nope.txt'))).toBe(false)
  })
})
