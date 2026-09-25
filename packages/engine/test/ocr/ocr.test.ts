// OCR with the bundled English model. Runs when SPARKY_TEST_BIN holds tessdata/eng.traineddata.gz (npm run fetch-tools).
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BIN, harness, type Harness } from '../image/harness'

const TESSDATA = BIN ? path.join(BIN, 'tessdata', 'eng.traineddata.gz') : undefined
const hasEnglish = Boolean(TESSDATA && fs.existsSync(TESSDATA))

async function textImage(text: string, file: string): Promise<void> {
  const canvas = createCanvas(900, 240)
  const g = canvas.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 900, 240)
  g.fillStyle = '#000000'
  g.font = 'bold 120px Arial'
  g.textBaseline = 'middle'
  g.fillText(text, 30, 120)
  fs.writeFileSync(file, await canvas.encode('png'))
}

async function pdfText(file: string, pageNumber = 1): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true })
  const doc = await task.promise
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  await task.destroy()
  return content.items.map((i) => ('str' in i ? i.str : '')).join(' ')
}

/** A two-page letter-size PDF with one large word per page, drawn with a standard font pdf.js renders without system fonts. */
async function twoPagePdf(file: string, words: [string, string]): Promise<void> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  for (const word of words) doc.addPage([612, 792]).drawText(word, { x: 60, y: 500, size: 36, font })
  fs.writeFileSync(file, await doc.save())
}

describe.skipIf(!hasEnglish)('ocr', () => {
  let h: Harness
  let png: string
  beforeAll(async () => {
    h = await harness('ocr')
    png = path.join(h.dir, 'sign.png')
    await textImage('SPARKY 123', png)
  })
  afterAll(() => h?.close())

  it('finds the bundled language folder', () => {
    expect(fs.existsSync(TESSDATA!)).toBe(true)
  })

  it('reads the text into a .txt by default', async () => {
    const [job] = await h.engine.runOp('ocr', { files: [png] })
    expect(job).toMatchObject({ status: 'done', kind: 'tool', op: 'ocr', title: 'Read text in sign.png → TXT' })
    const out = job!.outputs![0]!
    expect(path.basename(out)).toBe('sign.txt')
    expect(fs.readFileSync(out, 'utf8')).toContain('SPARKY')
    // The bundled model was read, then kept in the data folder for next time.
    expect(fs.existsSync(path.join(h.dir, 'data', 'tessdata', 'eng.traineddata'))).toBe(true)
  })

  it('makes a searchable PDF, or both files, from any picture sharp opens', async () => {
    const jpg = path.join(h.dir, 'sign.jpg')
    await sharp(png).jpeg({ quality: 90 }).toFile(jpg)
    const [job] = await h.engine.runOp('ocr', { files: [jpg], output: 'both', language: 'eng', out: path.join(h.dir, 'read') + path.sep })
    expect(job?.error).toBeUndefined()
    const outs = job!.outputs!
    expect(outs.map((o) => path.extname(o))).toEqual(['.txt', '.pdf'])
    expect(fs.readFileSync(outs[0]!, 'utf8')).toContain('SPARKY')
    const pdf = fs.readFileSync(outs[1]!)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(await pdfText(outs[1]!)).toContain('SPARKY')
  })

  it('reads every page of a PDF into one text file, pages in order and split by a form feed', async () => {
    const pdf = path.join(h.dir, 'letters.pdf')
    await twoPagePdf(pdf, ['FIRST', 'SECOND'])
    const [job] = await h.engine.runOp('ocr', { files: [pdf] })
    expect(job).toMatchObject({ status: 'done', title: 'Read text in letters.pdf → TXT' })
    const out = job!.outputs![0]!
    expect(path.basename(out)).toBe('letters.txt')
    const text = fs.readFileSync(out, 'utf8')
    const pages = text.split('\f')
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain('FIRST')
    expect(pages[1]).toContain('SECOND')
  })

  it('makes one searchable PDF from a PDF, the source page size kept', async () => {
    const pdf = path.join(h.dir, 'pair.pdf')
    await twoPagePdf(pdf, ['FIRST', 'SECOND'])
    const [job] = await h.engine.runOp('ocr', { files: [pdf], output: 'pdf', dpi: 150 })
    expect(job?.error).toBeUndefined()
    const out = job!.outputs![0]!
    expect(path.basename(out)).toBe('pair (searchable).pdf')
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(fs.readFileSync(out))
    expect(doc.getPageCount()).toBe(2)
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBeCloseTo(612, 0)
      expect(page.getHeight()).toBeCloseTo(792, 0)
    }
    expect(await pdfText(out, 1)).toContain('FIRST')
    expect(await pdfText(out, 2)).toContain('SECOND')
  })

  it('fails a damaged PDF in plain words', async () => {
    const bad = path.join(h.dir, 'broken.pdf')
    fs.writeFileSync(bad, '%PDF-1.4')
    const [job] = await h.engine.runOp('ocr', { files: [bad] })
    expect(job).toMatchObject({ status: 'failed' })
    expect(job!.error).toBeTruthy()
    expect(job!.error).not.toMatch(/Invalid PDF|Error:/)
  })

  it('says so when a picture has no text', async () => {
    const blank = path.join(h.dir, 'blank.png')
    await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } }).png().toFile(blank)
    const [job] = await h.engine.runOp('ocr', { files: [blank] })
    expect(job).toMatchObject({ status: 'done', note: 'No text was found in this picture.' })
  })

  it('stops the worker on cancel', async () => {
    const ac = new AbortController()
    const run = h.engine.runOp('ocr', { files: [png], output: 'pdf' }, { signal: ac.signal })
    setTimeout(() => ac.abort(), 50)
    const [job] = await run
    expect(job!.status).toBe('canceled')
  })

  /** Every worker thread started while `fn` runs, so a test can check none is left behind. */
  async function watchWorkers<T>(fn: () => Promise<T>): Promise<{ result: T; live: () => number }> {
    const live = new Set<Worker>()
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (this: Worker, ...args: Parameters<Worker['postMessage']>) {
      if (!live.has(this)) {
        live.add(this)
        this.once('exit', () => live.delete(this))
      }
      return post.apply(this, args)
    }
    try {
      return { result: await fn(), live: () => live.size }
    } finally {
      Worker.prototype.postMessage = post
    }
  }
  const settle = async (live: () => number) => {
    for (let i = 0; i < 40 && live() > 0; i++) await new Promise((r) => setTimeout(r, 50))
    return live()
  }
  const LANGUAGE_FAILED = /couldn’t get the “.*” language/

  it('fails an unknown language in plain words and leaves no worker running', async () => {
    const { result, live } = await watchWorkers(() => h.engine.runOp('ocr', { files: [png], language: 'qqzz' }, { timeoutMs: 30_000 }))
    expect(result[0]).toMatchObject({ status: 'failed' })
    expect(result[0]!.error).toMatch(LANGUAGE_FAILED)
    expect(await settle(live)).toBe(0)
  })

  it('fails a damaged language file instead of waiting forever, and stops its worker', async () => {
    const cache = path.join(h.dir, 'data', 'tessdata')
    fs.mkdirSync(cache, { recursive: true })
    fs.writeFileSync(path.join(cache, 'zzq.traineddata'), 'not a language model')
    const { result, live } = await watchWorkers(() => h.engine.runOp('ocr', { files: [png], language: 'zzq' }, { timeoutMs: 20_000 }))
    // Still stuck when the wait runs out: stop it so the rest of the suite can run.
    if (result[0]!.status === 'running') h.engine.cancelJob(result[0]!.id)
    expect(result[0]).toMatchObject({ status: 'failed' })
    expect(result[0]!.error).toMatch(LANGUAGE_FAILED)
    expect(await settle(live)).toBe(0)
  })

  it('refuses what it can’t read, before starting the worker', async () => {
    const doc = path.join(h.dir, 'scan.docx')
    fs.writeFileSync(doc, 'PK')
    expect((await h.engine.runOp('ocr', { files: [doc] }))[0]!.error).toMatch(/can’t read text from scan\.docx/)
    expect(() => h.engine.startOp('ocr', { files: [png], language: '../eng' })).toThrow(/language/)
    expect(() => h.engine.startOp('ocr', { files: [png], output: 'both', out: path.join(h.dir, 'one.txt') })).toThrow(/folder/)
  })
})
