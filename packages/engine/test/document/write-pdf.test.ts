import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { readPdfText, writePdf } from '../../src/document'

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount()
}

describe('writePdf', () => {
  it('writes one page for short text', async () => {
    expect(await pageCount(await writePdf('Hello'))).toBe(1)
  })

  it('adds pages as the input grows', async () => {
    const short = await pageCount(await writePdf(Array.from({ length: 40 }, (_, i) => `Line ${i}`).join('\n')))
    const long = await pageCount(await writePdf(Array.from({ length: 400 }, (_, i) => `Line ${i}`).join('\n')))
    expect(short).toBe(1)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeGreaterThanOrEqual(7)
  })

  it('wraps a long paragraph instead of running off the page', async () => {
    const paragraph = Array.from({ length: 3000 }, () => 'word').join(' ')
    expect(await pageCount(await writePdf(paragraph))).toBeGreaterThan(1)
  })

  it('hard-splits a single word wider than the line', async () => {
    const text = await readPdfText(await writePdf('x'.repeat(400)))
    expect(text.replace(/\s/g, '')).toBe('x'.repeat(400))
  })

  it('does not throw on characters WinAnsi cannot encode', async () => {
    const bytes = await writePdf('Emoji \u{1F600}, CJK 漢字, Cyrillic Ж, tab\tseparated')
    const text = await readPdfText(bytes)
    expect(text).toContain('Emoji ?')
    expect(text).toContain('tab separated')
  })

  it('keeps WinAnsi punctuation such as curly quotes and the euro sign', async () => {
    const text = await readPdfText(await writePdf('“Quoted” costs €5 — café'))
    expect(text).toContain('“Quoted”')
    expect(text).toContain('€5')
    expect(text).toContain('café')
  })

  it('swaps the page dimensions for landscape and honours the page size', async () => {
    const portrait = (await PDFDocument.load(await writePdf('a', { pageSize: 'letter' }))).getPage(0).getSize()
    const landscape = (await PDFDocument.load(await writePdf('a', { pageSize: 'letter', orientation: 'landscape' }))).getPage(0).getSize()
    expect(portrait).toEqual({ width: 612, height: 792 })
    expect(landscape).toEqual({ width: 792, height: 612 })
  })
})
