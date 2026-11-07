import type { FolderListing } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { checkTyped, crumbs, DENSITIES, foldCrumbs, formatDate, joinPath, mergeListing, parentOf, shownRows, toRows, typedPath, typeLabel } from './model'

function listing(entries: { name: string; dir?: boolean; size?: number; mtime?: number; hidden?: boolean }[]): FolderListing {
  return {
    names: entries.map((e) => e.name),
    kinds: Uint8Array.from(entries.map((e) => (e.dir ? 1 : 0))),
    sizes: Float64Array.from(entries.map((e) => e.size ?? 0)),
    mtimes: Float64Array.from(entries.map((e) => e.mtime ?? 0)),
    ctimes: new Float64Array(entries.length),
    attrs: Uint32Array.from(entries.map((e) => (e.dir ? 0x10 : 0) | (e.hidden ? 0x2 : 0))),
  }
}

const rows = toRows(
  listing([
    { name: 'file10.txt', size: 300, mtime: 3 },
    { name: 'b-folder', dir: true, mtime: 9 },
    { name: 'file2.txt', size: 100, mtime: 1 },
    { name: 'Alpha.mp4', size: 200, mtime: 2 },
    { name: 'a-folder', dir: true, mtime: 1 },
    { name: 'desktop.ini', size: 1, hidden: true },
  ]),
)

const names = (list: { name: string }[]) => list.map((r) => r.name)

describe('folder rows', () => {
  it('reads the columns into rows with kind, extension and hidden flag', () => {
    expect(rows[3]!).toMatchObject({ name: 'Alpha.mp4', dir: false, ext: 'mp4', size: 200, mtime: 2, hidden: false })
    expect(rows[1]!).toMatchObject({ dir: true, ext: '' })
    expect(rows[5]!.hidden).toBe(true)
  })

  it('sorts by name with folders first and numbers in natural order', () => {
    expect(names(shownRows(rows, { key: 'name', desc: false }, false))).toEqual(['a-folder', 'b-folder', 'Alpha.mp4', 'file2.txt', 'file10.txt'])
  })

  it('keeps folders first when the sort is reversed', () => {
    expect(names(shownRows(rows, { key: 'name', desc: true }, false))).toEqual(['b-folder', 'a-folder', 'file10.txt', 'file2.txt', 'Alpha.mp4'])
  })

  it('sorts by size, modified date and type', () => {
    expect(names(shownRows(rows, { key: 'size', desc: true }, false)).slice(2)).toEqual(['file10.txt', 'Alpha.mp4', 'file2.txt'])
    expect(names(shownRows(rows, { key: 'modified', desc: false }, false))).toEqual(['a-folder', 'b-folder', 'file2.txt', 'Alpha.mp4', 'file10.txt'])
    expect(names(shownRows(rows, { key: 'type', desc: false }, false)).slice(2)).toEqual(['Alpha.mp4', 'file2.txt', 'file10.txt'])
  })

  it('hides hidden items unless asked to show them', () => {
    expect(names(shownRows(rows, { key: 'name', desc: false }, false))).not.toContain('desktop.ini')
    expect(names(shownRows(rows, { key: 'name', desc: false }, true))).toContain('desktop.ini')
  })

  it('joins the head and the rest of a big listing in order', () => {
    const merged = mergeListing(listing([{ name: 'a' }]), listing([{ name: 'b', size: 5 }]))
    expect(merged.names).toEqual(['a', 'b'])
    expect(Array.from(merged.sizes)).toEqual([0, 5])
  })
})

describe('labels', () => {
  it('names the type like Explorer', () => {
    expect(typeLabel(rows[1]!)).toBe('Folder')
    expect(typeLabel(rows[3]!)).toBe('MP4 file')
    expect(typeLabel(toRows(listing([{ name: 'Makefile' }]))[0]!)).toBe('File')
  })

  it('formats the modified date as local date and time', () => {
    expect(formatDate(new Date(2026, 10, 7, 9, 5).getTime())).toBe('2026-11-07 09:05')
    expect(formatDate(0)).toBe('')
  })

  it('gives each density a row height, font size and tile size', () => {
    for (const d of Object.values(DENSITIES)) expect(d.row).toBeGreaterThan(0)
    expect(DENSITIES.compact.row).toBeLessThan(DENSITIES.roomy.row)
  })
})

describe('paths', () => {
  it('joins and climbs Windows paths', () => {
    expect(joinPath('C:\\', 'Users')).toBe('C:\\Users')
    expect(joinPath('C:\\Users', 'harry')).toBe('C:\\Users\\harry')
    expect(parentOf('C:\\Users\\harry')).toBe('C:\\Users')
    expect(parentOf('C:\\Users')).toBe('C:\\')
    expect(parentOf('C:\\')).toBeNull()
  })

  it('S5: splits a path into breadcrumb parts that each open their folder', () => {
    expect(crumbs('C:\\Users\\harry')).toEqual([
      { label: 'C:', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'harry', path: 'C:\\Users\\harry' },
    ])
    expect(crumbs('D:\\')).toEqual([{ label: 'D:', path: 'D:\\' }])
    expect(crumbs('\\\\nas\\share\\films')).toEqual([
      { label: '\\\\nas\\share', path: '\\\\nas\\share' },
      { label: 'films', path: '\\\\nas\\share\\films' },
    ])
  })

  it('S5: a deep path keeps the drive and the last three folders, the middle folds into a menu', () => {
    const deep = foldCrumbs(crumbs('C:\\Users\\harry\\AppData\\Local\\Temp\\navtest'))
    expect(deep.head.map((c) => c.label)).toEqual(['C:'])
    expect(deep.folded.map((c) => c.label)).toEqual(['Users', 'harry', 'AppData'])
    expect(deep.tail.map((c) => c.label)).toEqual(['Local', 'Temp', 'navtest'])
    const short = foldCrumbs(crumbs('C:\\Users\\harry\\Music'))
    expect(short).toEqual({ head: crumbs('C:\\Users\\harry\\Music'), folded: [], tail: [] })
  })

  it('S5: cleans a typed path: quotes, forward slashes, a bare drive', () => {
    expect(typedPath('  "C:/Users/harry/"  ')).toBe('C:\\Users\\harry')
    expect(typedPath('d:')).toBe('D:\\')
    expect(typedPath('c:/')).toBe('C:\\')
    expect(typedPath('   ')).toBe('')
  })

  it('S5: a typed path opens when it lists, and an unknown one gives the message', async () => {
    const list = async (path: string) => (path === 'C:\\Real' ? { ok: true as const, path } : { ok: false as const, path, message: "That folder doesn't exist." })
    expect(await checkTyped('C:/Real', list)).toEqual({ ok: true, path: 'C:\\Real' })
    expect(await checkTyped('C:\\Nope', list)).toEqual({ ok: false, message: "That folder doesn't exist." })
  })
})
