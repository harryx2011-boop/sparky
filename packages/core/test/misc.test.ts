import { describe, expect, it } from 'vitest'
import {
  compressionInfo, describeSaving, formatBytes, formatDuration, ghostscriptArgs, outputName, pandocArgs,
  parseSevenZipProgress, parseTime, performanceInfo, performanceProfile, savedPercent, sevenZipPackArgs,
} from '../src'

describe('levels', () => {
  it('maps performance to bars and threads', () => {
    expect(performanceInfo('low').bars).toBe(1)
    expect(performanceInfo('normal').bars).toBe(3)
    expect(performanceInfo('max').bars).toBe(5)
    expect(performanceProfile('normal', 2).threads).toBe(1)
    expect(performanceProfile('normal', 16).threads).toBe(8)
  })

  it('matches the spec compression table', () => {
    expect([0, 1, 2, 3, 4].map((l) => compressionInfo(l).crf)).toEqual([16, 20, 23, 28, 32])
    expect([0, 1, 2, 3, 4].map((l) => compressionInfo(l).audioKbps)).toEqual([320, 256, 192, 128, 96])
    expect([0, 1, 2, 3, 4].map((l) => compressionInfo(l).imageQuality)).toEqual([95, 88, 80, 70, 55])
    expect(compressionInfo(9).label).toBe('Tiny')
  })
})

describe('display', () => {
  it('formats sizes and times', () => {
    expect(formatBytes(8 * 1024)).toBe('8.0 KB')
    expect(formatBytes(318 * 1024 * 1024)).toBe('318 MB')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatDuration(42)).toBe('0:42')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('describes savings', () => {
    expect(savedPercent(100, 30)).toBe(70)
    expect(describeSaving(1024 * 1024, 512 * 1024)).toBe('1.0 MB → 512 KB · 50% smaller')
    expect(describeSaving(100, 150)).toMatch(/50% larger/)
  })

  it('parses trim times', () => {
    expect(parseTime('1:30')).toBe(90)
    expect(parseTime('01:02:03')).toBe(3723)
    expect(parseTime('1m30s')).toBe(90)
    expect(parseTime('12.5')).toBe(12.5)
    expect(parseTime('abc')).toBeUndefined()
  })

  it('picks a free output name', () => {
    const taken = new Set(['clip.mp4', 'clip (2).mp4'])
    expect(outputName('clip.mov', 'mp4', (n) => taken.has(n))).toBe('clip (3).mp4')
    expect(outputName('photos.zip', 'folder', () => false)).toBe('photos')
  })
})

describe('tools', () => {
  it('builds pandoc, ghostscript and 7-Zip commands', () => {
    expect(pandocArgs('a.md', 'a.html')).toEqual(expect.arrayContaining(['--from', 'gfm', '--to', 'html', '--standalone']))
    expect(pandocArgs('a.docx', 'a.txt')).toEqual(expect.arrayContaining(['--to', 'plain']))
    expect(ghostscriptArgs('a.pdf', 'b.pdf', 4)).toContain('-dPDFSETTINGS=/screen')
    expect(sevenZipPackArgs('out.7z', 4)).toEqual(expect.arrayContaining(['-t7z', '-mx=9']))
    expect(parseSevenZipProgress('  12% 3\r  45% 9 + x')).toBe(0.45)
  })
})
