// Spec scenario S44 (docs/specs/file-manager.md) and agent files A5: trash only to the Recycle Bin, and restore from it.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { restore, trash } from '../src/index'

const root = mkdtempSync(join(tmpdir(), 'fs-native-trash-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe.runIf(process.platform === 'win32')('fs-native trash', () => {
  it('trashes a file to the Recycle Bin and restores it with the same bytes', () => {
    const p = join(root, 'keep me.bin')
    const bytes = randomBytes(4096)
    writeFileSync(p, bytes)

    const [item] = trash([p])
    expect(item!.path).toBe(p)
    expect(existsSync(p)).toBe(false)

    expect(restore(p, item!.deletedAt)).toBe(p)
    expect(readFileSync(p).equals(bytes)).toBe(true)
  }, 60_000)

  it('restore refuses when something already sits at the original path', () => {
    const p = join(root, 'twice.txt')
    writeFileSync(p, 'first')
    const [item] = trash([p])
    writeFileSync(p, 'second')
    expect(() => restore(p, item!.deletedAt)).toThrow(/already/)
    rmSync(p)
    expect(restore(p, item!.deletedAt)).toBe(p)
    expect(readFileSync(p, 'utf8')).toBe('first')
  }, 60_000)

  it('refuses a path of 260 or more characters, which the shell would delete for good, and leaves it', () => {
    const dir = join(root, 'd'.repeat(120), 'e'.repeat(120))
    mkdirSync(dir, { recursive: true })
    const p = join(dir, 'long.txt')
    expect(p.length).toBeGreaterThanOrEqual(260)
    writeFileSync(p, 'x')
    expect(() => trash([p])).toThrow(/too long for the Recycle Bin/)
    expect(existsSync(p)).toBe(true)
  }, 60_000)

  it('trashes a folder once when the call also names its child or repeats it, and restores the whole folder', () => {
    const dir = join(root, 'nested')
    mkdirSync(dir)
    writeFileSync(join(dir, 'child.txt'), 'kid')

    const t0 = Date.now()
    const items = trash([dir, join(dir, 'child.txt'), dir])
    expect(Date.now() - t0).toBeLessThan(20_000)
    expect(items.map((i) => i.path)).toEqual([dir])
    expect(existsSync(dir)).toBe(false)

    restore(dir, items[0]!.deletedAt)
    expect(readFileSync(join(dir, 'child.txt'), 'utf8')).toBe('kid')
  }, 90_000)

  it('S44: No silent delete: a path on a volume with no Recycle Bin is refused and stays', () => {
    const p = join(root, 'stays.txt')
    writeFileSync(p, 'x')
    const unc = `\\\\localhost\\${p[0]}$${p.slice(2)}`
    expect(() => trash([unc])).toThrow(/stays\.txt is on a drive with no Recycle Bin, so it was not deleted/)
    expect(existsSync(p)).toBe(true)
  }, 60_000)
})
