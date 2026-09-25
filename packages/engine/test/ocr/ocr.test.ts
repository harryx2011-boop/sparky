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

async function pdfText(file: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true })
  const doc = await task.promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  await task.destroy()
  return content.items.map((i) => ('str' in i ? i.str : '')).join(' ')
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
    const pdf = path.join(h.dir, 'scan.pdf')
    fs.writeFileSync(pdf, '%PDF-1.4')
    expect((await h.engine.runOp('ocr', { files: [pdf] }))[0]!.error).toMatch(/can’t read text from scan\.pdf/)
    expect(() => h.engine.startOp('ocr', { files: [png], language: '../eng' })).toThrow(/language/)
    expect(() => h.engine.startOp('ocr', { files: [png], output: 'both', out: path.join(h.dir, 'one.txt') })).toThrow(/folder/)
  })
})
