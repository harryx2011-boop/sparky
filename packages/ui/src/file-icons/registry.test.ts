/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FORMATS, INPUT_EXTS } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { EXT_ICONS, extOf, FAMILY_ICONS, fileIconFor, fileIconName, PACK_ONLY_EXTS } from './registry'
import { FILE_ICON_SVGS } from './svgs'

const svgDir = fileURLToPath(new URL('./svg', import.meta.url))
const fileFor = (name: string) => join(svgDir, `${name.startsWith('default_') ? name : `file_type_${name}`}.svg`)

describe('file icon registry', () => {
  it('gives every extension Sparky reads or writes its own vendored SVG', () => {
    const exts = [...new Set([...INPUT_EXTS, ...FORMATS.map((f) => f.ext)])]
    const missing = exts.filter((e) => !EXT_ICONS[e])
    expect(missing).toEqual([])
    for (const ext of exts) {
      const name = fileIconName(ext)
      expect(existsSync(fileFor(name)), `${ext} → ${name}`).toBe(true)
    }
  })

  it('ships exactly the SVGs it maps, and svgs.ts matches svg/', () => {
    const used = new Set([...Object.values(EXT_ICONS), ...Object.values(FAMILY_ICONS), 'default_file'])
    expect(new Set(Object.keys(FILE_ICON_SVGS))).toEqual(used)
    expect(readdirSync(svgDir).filter((f) => f.endsWith('.svg')).length).toBe(used.size)
    for (const [name, svg] of Object.entries(FILE_ICON_SVGS)) expect(readFileSync(fileFor(name), 'utf8').trim()).toBe(svg)
  })

  it('keeps Sparky transport streams on the video icon, not TypeScript', () => {
    expect(fileIconName('clip.TS')).toBe('video')
  })

  it('keeps the pack icon for transport streams even where Windows maps them to TypeScript', () => {
    expect([...PACK_ONLY_EXTS].sort()).toEqual(['mts', 'ts'])
    for (const ext of PACK_ONLY_EXTS) expect(fileIconName(ext)).toBe('video')
  })

  it('falls back to the family, then a plain page', () => {
    expect(fileIconName('x.qqq', 'audio')).toBe('audio')
    expect(fileIconName('x.qqq')).toBe('default_file')
    expect(fileIconFor('C:\\a.b\\Report.PDF').name).toBe('pdf2')
    expect(extOf('.Mp4')).toBe('mp4')
  })

  it('carries no title tooltip and no script', () => {
    for (const svg of Object.values(FILE_ICON_SVGS)) expect(svg).not.toMatch(/<title|<script|on\w+=/i)
  })
})
