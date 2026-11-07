// Agents read folders through these: listing with filters, paging and a summary, stat of many paths, and find by name (S34-S37).
import { list } from '@sparky/fs-native'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findFiles, listFiles, statFiles, type Lister } from '../src/files'

let root: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-files-'))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function file(rel: string, bytes = 0, mtime?: Date) {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, Buffer.alloc(bytes))
  if (mtime) fs.utimesSync(p, mtime, mtime)
  return p
}

describe('listFiles', () => {
  it('S34: List a folder: a summary of the whole folder, one page of rows and a cursor to the next page', () => {
    for (let i = 0; i < 539; i++) file(`f${i}.${i % 3 === 0 ? 'pdf' : 'txt'}`, 10)
    fs.mkdirSync(path.join(root, 'a'))
    fs.mkdirSync(path.join(root, 'b'))

    const first = listFiles({ path: root, limit: 200 })
    expect(first.summary).toMatchObject({ files: 539, dirs: 2, bytes: 5390 })
    expect(first.summary.exts[0]!).toEqual(['txt', 359])
    expect(first.entries).toHaveLength(200)
    expect(first.entries.slice(0, 2).map((e) => [e.name, e.kind])).toEqual([['a', 'dir'], ['b', 'dir']])
    expect(first.entries[2]!).toMatchObject({ name: 'f0.pdf', kind: 'file', size: 10 })
    expect(first.entries[3]!.name).toBe('f1.txt')
    expect(first.next).toBe('200')

    const second = listFiles({ path: root, limit: 200, cursor: first.next })
    expect(second.entries[0]!.name).not.toBe(first.entries[0]!.name)
    const third = listFiles({ path: root, limit: 200, cursor: second.next })
    expect(third.entries).toHaveLength(141)
    expect(third.next).toBeUndefined()
  })

  it('S35: Filtered list: depth, glob, size range and sort pick only the matching files', () => {
    file('top.pdf', 50)
    file('one/mid.pdf', 500)
    file('one/two/deep.pdf', 5000)
    file('one/two/three/too-deep.pdf', 500)
    file('one/two/note.txt', 500)
    file('one/tiny.pdf', 1)

    const res = listFiles({ path: root, depth: 3, glob: '*.pdf', minSize: 10, sort: 'size', desc: true })
    expect(res.entries.map((e) => e.name)).toEqual([path.join('one', 'two', 'deep.pdf'), path.join('one', 'mid.pdf'), 'top.pdf'])
    expect(res.summary).toMatchObject({ files: 3, dirs: 0, bytes: 5550 })
  })

  it('filters by modified date, kind and extension', () => {
    file('old.txt', 1, new Date('2020-01-01T00:00:00Z'))
    file('new.txt', 1, new Date('2026-01-01T00:00:00Z'))
    file('new.md', 1, new Date('2026-01-01T00:00:00Z'))
    fs.mkdirSync(path.join(root, 'folder'))

    expect(listFiles({ path: root, after: '2025-01-01' }).entries.map((e) => e.name)).toEqual(['folder', 'new.md', 'new.txt'])
    expect(listFiles({ path: root, kind: 'file', ext: ['TXT'] }).entries.map((e) => e.name)).toEqual(['new.txt', 'old.txt'])
    expect(listFiles({ path: root, kind: 'dir' }).entries.map((e) => e.name)).toEqual(['folder'])
  })

  it('a glob with a slash matches the path from the listed folder', () => {
    file('one/a.pdf')
    file('two/a.pdf')
    expect(listFiles({ path: root, depth: 2, glob: 'one/*.pdf' }).entries.map((e) => e.name)).toEqual([path.join('one', 'a.pdf')])
  })

  it('names a missing folder plainly', () => {
    expect(() => listFiles({ path: path.join(root, 'nope') })).toThrow(/doesn't exist/)
  })
})

describe('statFiles', () => {
  it('S36: Stat many paths: facts for each that exists and "missing" for the rest, in one answer', () => {
    const a = file('a.txt', 3)
    fs.mkdirSync(path.join(root, 'dir'))
    const missing = path.join(root, 'gone.txt')

    const res = statFiles([a, path.join(root, 'dir'), missing])
    expect(res[0]!).toMatchObject({ path: a, kind: 'file', size: 3, ext: 'txt' })
    const r0 = res[0]!
    expect(r0.kind === 'file' && r0.mtime).toBeGreaterThan(0)
    expect(res[1]).toMatchObject({ kind: 'dir' })
    expect(res[2]).toEqual({ path: missing, kind: 'missing' })
  })

  it('stats a drive root', () => {
    const drive = path.parse(root).root
    expect(statFiles([drive])[0]).toMatchObject({ path: drive, kind: 'dir' })
  })
})

describe('findFiles', () => {
  const refuse = (blocked: string): Lister => (p) => {
    if (p === blocked) throw Object.assign(new Error('refused'), { code: 'EACCES' })
    return list(p)
  }

  it('S37: Find by name: each match once, the junction loop not followed, the blocked folder counted', () => {
    file('a/b/clip1.mp4')
    file('c/clip2.mp4')
    file('c/notes.txt')
    file('c/blocked/hidden-clip.mp4')
    fs.symlinkSync(root, path.join(root, 'a', 'loop'), 'junction')

    const res = findFiles({ path: root, glob: '*.mp4' }, refuse(path.join(root, 'c', 'blocked')))
    expect(res.entries.map((e) => e.name).sort()).toEqual([path.join('a', 'b', 'clip1.mp4'), path.join('c', 'clip2.mp4')])
    expect(res.skipped).toBe(1)
    expect(res.next).toBeUndefined()
  })

  it('matches plain text anywhere in the name, ignoring case', () => {
    file('Report-2026.pdf')
    file('old/annual report.docx')
    file('other.txt')
    expect(findFiles({ path: root, text: 'REPORT' }).entries.map((e) => e.name).sort()).toEqual(['Report-2026.pdf', path.join('old', 'annual report.docx')])
  })

  it('stops at the limit and hands back a cursor to the next matches', () => {
    for (let i = 0; i < 5; i++) file(`d${i}/hit.log`)
    const first = findFiles({ path: root, glob: '*.log', limit: 2 })
    expect(first.entries).toHaveLength(2)
    expect(first.next).toBe('2')
    const rest = findFiles({ path: root, glob: '*.log', limit: 10, cursor: first.next })
    expect(rest.entries).toHaveLength(3)
    expect(rest.next).toBeUndefined()
    expect(new Set([...first.entries, ...rest.entries].map((e) => e.name)).size).toBe(5)
  })
})
