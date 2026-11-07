// Spec scenarios S1, S2 and S4 (docs/specs/file-manager.md) for the native folder lister.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { list, listFallback, native, type Listing } from '../src/index'

const root = mkdtempSync(join(tmpdir(), 'fs-native-'))
const STAMP = new Date('2026-01-02T03:04:05Z')

function warmList(path: string): { listing: Listing; ms: number } {
  list(path)
  const start = performance.now()
  const listing = list(path)
  return { listing, ms: performance.now() - start }
}

async function fill(dir: string, count: number, sized: boolean) {
  mkdirSync(dir, { recursive: true })
  for (let start = 0; start < count; start += 500) {
    const batch = Array.from({ length: Math.min(500, count - start) }, (_, k) => start + k)
    await Promise.all(batch.map((i) => writeFile(join(dir, `f${i}.txt`), sized ? 'x'.repeat(i % 7) : '')))
  }
}

afterAll(() => rm(root, { recursive: true, force: true }), 300_000)

describe('fs-native list', () => {
  const small = join(root, 'small')

  beforeAll(() => {
    mkdirSync(join(small, 'sub'), { recursive: true })
    writeFileSync(join(small, 'a.mp4'), 'abcdef')
    writeFileSync(join(small, 'b.txt'), '')
    utimesSync(join(small, 'a.mp4'), STAMP, STAMP)
  })

  it('loads the compiled addon, not the fallback', () => {
    expect(native).toBe(true)
  })

  it('returns names, kinds, sizes and dates as columns', () => {
    const l = list(small)
    const at = (name: string) => l.names.indexOf(name)
    expect([...l.names].sort()).toEqual(['a.mp4', 'b.txt', 'sub'])
    expect(l.kinds[at('sub')]).toBe(1)
    expect(l.kinds[at('a.mp4')]).toBe(0)
    expect(l.sizes[at('a.mp4')]).toBe(6)
    expect(l.mtimes[at('a.mp4')]).toBe(STAMP.getTime())
    expect(l.ctimes[at('a.mp4')]).toBeGreaterThan(0)
    expect(l.attrs[at('sub')]! & 0x10).toBe(0x10)
  })

  it('matches the Node fallback for the same folder', () => {
    const a = list(small)
    const b = listFallback(small)
    const rows = (l: Listing) => l.names.map((n, i) => [n, l.kinds[i], l.sizes[i], l.mtimes[i]]).sort()
    expect(rows(a)).toEqual(rows(b))
  })

  it('S1: lists 5,000 files with size and modified date within 300 ms', async () => {
    const dir = join(root, 'five-k')
    await fill(dir, 5000, true)
    const { listing, ms } = warmList(dir)
    expect(listing.names.length).toBe(5000)
    expect(listing.sizes[listing.names.indexOf('f13.txt')]).toBe(13 % 7)
    expect(ms).toBeLessThan(300)
  })

  it('S1: lists 100,000 entries within 300 ms on a warm cache', { timeout: 600_000 }, async () => {
    const dir = join(root, 'hundred-k')
    await fill(dir, 100_000, false)
    const { listing, ms } = warmList(dir)
    expect(listing.names.length).toBe(100_000)
    console.log(`100k entries listed in ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(300)
  })

  it('S2: lists a folder whose path is over 260 characters', () => {
    let dir = join(root, 'long')
    while (dir.length <= 300) dir = join(dir, 'a-long-folder-name-for-the-path-limit')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'deep.txt'), 'hi')
    expect(dir.length).toBeGreaterThan(260)
    expect(list(dir).names).toEqual(['deep.txt'])
  })

  const unc = `\\\\localhost\\${small[0]}$${small.slice(2)}`
  const uncReachable = (() => {
    try {
      return readdirSync(unc).length > 0
    } catch {
      return false
    }
  })()

  it.skipIf(!uncReachable)('S2: lists a UNC share path', () => {
    expect([...list(unc).names].sort()).toEqual(['a.mp4', 'b.txt', 'sub'])
  })

  const blocked = 'C:\\System Volume Information'
  const isBlocked = (() => {
    if (!existsSync(blocked)) return false
    try {
      readdirSync(blocked)
      return false
    } catch {
      return true
    }
  })()

  it.skipIf(!isBlocked)('S4: a folder the user may not read throws EACCES', () => {
    expect(() => list(blocked)).toThrow(expect.objectContaining({ code: 'EACCES' }))
  })

  it('a missing folder throws ENOENT', () => {
    expect(() => list(join(root, 'nope'))).toThrow(expect.objectContaining({ code: 'ENOENT' }))
  })

  it('a file path throws ENOTDIR', () => {
    expect(() => list(join(small, 'b.txt'))).toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
  })

  it('an empty folder lists nothing', () => {
    const dir = join(root, 'empty')
    mkdirSync(dir)
    expect(list(dir).names).toEqual([])
  })

  it('a junction reads as a folder with the reparse flag, in the addon and the fallback alike', () => {
    const dir = join(root, 'with-junction')
    mkdirSync(join(dir, 'real'), { recursive: true })
    symlinkSync(join(dir, 'real'), join(dir, 'jump'), 'junction')
    for (const l of [list(dir), listFallback(dir)]) {
      const i = l.names.indexOf('jump')
      expect(l.kinds[i]).toBe(1)
      expect(l.attrs[i]! & 0x400).toBe(0x400)
    }
  })

  it('a drive root lists without . and ..', () => {
    const names = list(`${small[0]}:\\`).names
    expect(names).not.toContain('.')
    expect(names).not.toContain('..')
    expect(names.length).toBeGreaterThan(0)
  })
})
