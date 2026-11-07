import type { FolderListing } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { DENSITIES, formatDate, joinPath, mergeListing, parentOf, shownRows, toRows, typeLabel } from './model'

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
})
