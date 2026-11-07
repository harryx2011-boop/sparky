// The agent file read tools: token-lean text answers for list, find and stat, and the folder guard (S34-S38).
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { callFileTool, FILE_TOOLS, isFileTool } from '../src/mcp-files'
import { tempDir } from './helpers'

let root: string
let outside: string
const text = (r: { content: unknown }) => (r.content as { text: string }[])[0]!.text

beforeAll(() => {
  root = fs.realpathSync(tempDir('sparky-files-root-'))
  outside = fs.realpathSync(tempDir('sparky-files-out-'))
  fs.mkdirSync(path.join(root, 'Archive'))
  for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(root, `clip${i}.mp4`), Buffer.alloc(1000 * (i + 1)))
  fs.writeFileSync(path.join(root, 'Archive', 'old.mp4'), Buffer.alloc(10))
  fs.writeFileSync(path.join(root, 'notes.txt'), 'hi')
  const when = new Date(2026, 0, 31, 9, 5)
  fs.utimesSync(path.join(root, 'notes.txt'), when, when)
})
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(outside, { recursive: true, force: true })
})

const call = (name: string, input: Record<string, unknown>) => callFileTool(name, input, [root])

describe('file read tools', () => {
  it('are three read-only tools', () => {
    expect(FILE_TOOLS.map((t) => t.name)).toEqual(['sparky_files_list', 'sparky_files_find', 'sparky_files_stat'])
    expect(FILE_TOOLS.every((t) => t.annotations?.readOnlyHint)).toBe(true)
    expect(isFileTool('sparky_files_list')).toBe(true)
    expect(isFileTool('sparky_convert')).toBe(false)
  })

  it('S34: List a folder: a summary line, tab-separated rows of name, size and modified time, and a cursor line', () => {
    const r = call('sparky_files_list', { path: root, limit: 3 })
    expect(r.isError).toBeFalsy()
    const lines = text(r).split('\n')
    expect(lines[0]).toBe(`${root}: 6 files, 1 folder, 14.7 KB (mp4 5, txt 1). Rows 1-3 of 7.`)
    expect(lines[1]).toBe('name\tsize\tmodified')
    expect(lines[2]).toMatch(/^Archive\\\t\t\d{4}-\d\d-\d\d \d\d:\d\d$/)
    expect(lines[3]).toMatch(/^clip0\.mp4\t1000\t/)
    expect(lines.at(-1)).toBe('more: cursor=3')

    const last = text(call('sparky_files_list', { path: root, limit: 3, cursor: '6' })).split('\n')
    expect(last[0]).toMatch(/Rows 7-7 of 7\.$/)
    expect(last[2]).toBe('notes.txt\t2\t2026-01-31 09:05')
    expect(last.at(-1)).not.toMatch(/^more:/)
  })

  it('S35: passes filters and sort through', () => {
    const lines = text(call('sparky_files_list', { path: root, depth: 2, glob: '*.mp4', minSize: 2000, sort: 'size', desc: true })).split('\n')
    expect(lines.slice(2).map((l) => l.split('\t')[0])).toEqual(['clip4.mp4', 'clip3.mp4', 'clip2.mp4', 'clip1.mp4'])
  })

  it('S36: Stat many paths: one line each, missing ones marked', () => {
    const lines = text(call('sparky_files_stat', { paths: [path.join(root, 'notes.txt'), path.join(root, 'Archive'), path.join(root, 'gone.txt')] })).split('\n')
    expect(lines[0]).toBe('path\tkind\tsize\tmodified\tflags')
    expect(lines[1]).toBe(`${path.join(root, 'notes.txt')}\tfile\t2\t2026-01-31 09:05\t`)
    expect(lines[2]).toMatch(/\tdir\t\t/)
    expect(lines[3]).toBe(`${path.join(root, 'gone.txt')}\tmissing\t\t\t`)
  })

  it('S37: Find by name lists matches with paths from the searched folder', () => {
    const lines = text(call('sparky_files_find', { path: root, glob: '*.mp4', limit: 10 })).split('\n')
    expect(lines[0]).toBe(`6 matches under ${root}.`)
    expect(lines.slice(2).map((l) => l.split('\t')[0])).toContain(path.join('Archive', 'old.mp4'))
  })

  it('S38: Read outside the roots: list, find and stat are refused and name the allowed folders', () => {
    for (const [name, input] of [
      ['sparky_files_list', { path: outside }],
      ['sparky_files_find', { path: outside, text: 'x' }],
      ['sparky_files_stat', { paths: [path.join(root, 'notes.txt'), path.join(outside, 'a.txt')] }],
      ['sparky_files_list', { path: '\\\\server\\share' }],
    ] as const) {
      const r = call(name, input)
      expect(r.isError, name).toBe(true)
      expect(text(r)).toContain(root)
    }
  })

  it('says plainly when a path is missing or a field is wrong', () => {
    expect(text(call('sparky_files_list', { path: path.join(root, 'nope') }))).toMatch(/doesn't exist/)
    expect(call('sparky_files_list', {}).isError).toBe(true)
    expect(text(call('sparky_files_list', { path: root, after: 'soon' }))).toMatch(/after/)
  })
})
