// The pdf ops end to end through createEngine().runOp, on PDFs and pictures made in the test.
import type { Job } from '@sparky/core'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inputSchema, parseOpInput, RESERVED_INPUTS } from '../../src'
import { pdfOps } from '../../src/ops/pdf'
import { makePdf, makePicture, pageCount, pdfOf, rig, type Rig } from './helpers'

const IDS = [
  'pdf.from_images',
  'pdf.to_images',
  'pdf.merge',
  'pdf.split',
  'pdf.rotate',
  'pdf.remove_pages',
  'pdf.extract_pages',
  'pdf.extract_images',
  'pdf.compress',
  'pdf.protect',
  'pdf.unlock',
  'pdf.flatten',
]

describe('pdf op registry', () => {
  it('registers every pdf op with a flat schema and no reserved names', () => {
    expect(pdfOps.map((o) => o.id)).toEqual(IDS)
    for (const op of pdfOps) {
      expect(op).toMatchObject({ category: 'pdf', kind: 'tool', positional: ['files'], paths: ['files'] })
      const js = inputSchema(op)
      expect(js.type).toBe('object')
      expect(Object.keys(js.properties as object)).toContain('out')
      for (const name of RESERVED_INPUTS) expect(Object.keys(op.input.shape), `${op.id}.${name}`).not.toContain(name)
      expect(JSON.stringify(js)).not.toMatch(/maxItems|maxLength/)
      for (const [name, field] of Object.entries(js.properties as Record<string, { title?: string; description?: string }>)) {
        if (name === 'out') continue
        expect(field.title, `${op.id}.${name} title`).toBeTruthy()
        expect(field.description, `${op.id}.${name} description`).toBeTruthy()
        const choices = (field as { enum?: unknown[]; anyOf?: { const?: unknown }[] }).enum ?? (field as { anyOf?: { const?: unknown }[] }).anyOf?.map((c) => c.const)
        if (choices) {
          const labels = (field as { labels?: Record<string, string> }).labels ?? {}
          for (const c of choices) expect(labels[String(c)], `${op.id}.${name} label for ${String(c)}`).toBeTruthy()
        }
      }
    }
    expect(pdfOps.filter((o) => o.requires?.includes('ghostscript')).map((o) => o.id)).toEqual(['pdf.compress', 'pdf.protect', 'pdf.unlock'])
  })

  it('declares every boolean’s real default, so a form that leaves it alone still means it', () => {
    const booleans: string[] = []
    for (const op of pdfOps) {
      for (const [name, field] of Object.entries(inputSchema(op).properties as Record<string, { type?: string; default?: unknown }>)) {
        if (field.type !== 'boolean') continue
        booleans.push(`${op.id}.${name}`)
        expect(field.default, `${op.id}.${name}`).toBe(true)
      }
    }
    expect(booleans.sort()).toEqual(['pdf.from_images.merge', 'pdf.protect.allowCopy', 'pdf.protect.allowPrint'])
    const protect = pdfOps.find((o) => o.id === 'pdf.protect')!
    expect(parseOpInput(protect, { files: ['a.pdf'], userPassword: 'x' }).args).toMatchObject({ allowPrint: true, allowCopy: true })
    expect(parseOpInput(protect, { files: ['a.pdf'], userPassword: 'x', allowPrint: false }).args).toMatchObject({ allowPrint: false })
  })
})

describe('pdf ops', () => {
  let r: Rig
  let three: string
  let five: string
  const ok = (job: Job) => {
    expect(job.error).toBeUndefined()
    expect(job.status).toBe('done')
    for (const o of job.outputs) expect(fs.existsSync(o), o).toBe(true)
    return job.outputs
  }

  beforeAll(async () => {
    r = await rig()
    three = await makePdf(path.join(r.dir, 'three.pdf'), 3)
    five = await makePdf(path.join(r.dir, 'five.pdf'), 5)
  })
  afterAll(() => r?.close())

  it('pdf.from_images: one PDF, each page the picture’s size at its DPI', async () => {
    const a = await makePicture(path.join(r.dir, 'wide.png'), 400, 300, 144)
    const b = await makePicture(path.join(r.dir, 'photo.jpg'), 300, 200)
    const [out] = ok(await r.run('pdf.from_images', { files: [a, b] }))
    expect(path.basename(out!)).toBe('wide (pages).pdf')
    const doc = await pdfOf(out!)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getSize()).toEqual({ width: 200, height: 150 })
    expect(doc.getPage(1).getSize()).toEqual({ width: 300, height: 200 })
  })

  it('pdf.from_images: paper size, orientation and margins, one PDF per picture', async () => {
    const a = await makePicture(path.join(r.dir, 'land.png'), 600, 300)
    const b = await makePicture(path.join(r.dir, 'tall.png'), 300, 600)
    const job = await r.run('pdf.from_images', { files: [a, b], pageSize: 'a4', orientation: 'auto', marginMm: 10, fit: 'cover', merge: false })
    const outs = ok(job)
    expect(outs.map((o) => path.basename(o))).toEqual(['land.pdf', 'tall.pdf'])
    const land = (await pdfOf(outs[0]!)).getPage(0).getSize()
    expect(land.width).toBeCloseTo(841.89, 1)
    expect(land.height).toBeCloseTo(595.28, 1)
    expect((await pdfOf(outs[1]!)).getPage(0).getSize().width).toBeCloseTo(595.28, 1)
  })

  it('pdf.from_images: fails in plain words on something that isn’t a picture', async () => {
    const fake = path.join(r.dir, 'fake.png')
    fs.writeFileSync(fake, 'not a picture')
    const job = await r.run('pdf.from_images', { files: [fake] })
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/can’t read fake\.png as a picture/)
  })

  it('pdf.to_images: every page into a folder named after the PDF', async () => {
    const [folder] = ok(await r.run('pdf.to_images', { files: [three], dpi: 72 }))
    expect(path.basename(folder!)).toBe('three')
    expect(path.basename(path.dirname(folder!))).toBe('Images')
    const files = fs.readdirSync(folder!).sort()
    expect(files).toEqual(['three (page 1).png', 'three (page 2).png', 'three (page 3).png'])
    const meta = await sharp(path.join(folder!, files[1]!)).metadata()
    expect([meta.width, meta.height]).toEqual([120, 220])
  })

  it('pdf.to_images: one page gives one picture, scaled by the DPI', async () => {
    const [file] = ok(await r.run('pdf.to_images', { files: [three], pages: '3', format: 'jpg', dpi: 144, quality: 70 }))
    expect(path.basename(file!)).toBe('three (page 3).jpg')
    const meta = await sharp(file!).metadata()
    expect(meta).toMatchObject({ format: 'jpeg', width: 260, height: 460 })
    const out = path.join(r.dir, 'picked.webp')
    ok(await r.run('pdf.to_images', { files: [three], pages: '1', format: 'webp', out }))
    expect((await sharp(out).metadata()).format).toBe('webp')
  })

  it('pdf.to_images: refuses a file name for many pages, and a page past the end', async () => {
    await expect(r.engine.runOp('pdf.to_images', { files: [three], out: path.join(r.dir, 'one.png') })).rejects.toMatchObject({ code: 'invalid_input', field: 'out' })
    const job = await r.run('pdf.to_images', { files: [three], pages: '4' })
    expect(job.error).toMatch(/has 3 pages, so there is no page 4/)
  })

  it('pdf.to_images: stops between pages when canceled and leaves nothing behind', async () => {
    const big = await makePdf(path.join(r.dir, 'big.pdf'), 40)
    const ctrl = new AbortController()
    const onChange = (jobs: Job[]) => {
      if (jobs.some((j) => j.op === 'pdf.to_images' && j.status === 'running' && j.progress > 0)) ctrl.abort()
    }
    r.engine.on('change', onChange)
    const job = await r.run('pdf.to_images', { files: [big], dpi: 300 }, ctrl.signal)
    r.engine.off('change', onChange)
    expect(job.status).toBe('canceled')
    const images = path.join(r.dir, 'Sparky', 'Images')
    expect(fs.readdirSync(images).filter((n) => n.startsWith('big') || n.startsWith('.sparky-'))).toEqual([])
  })

  it('pdf.merge: files in order into one PDF', async () => {
    const [out] = ok(await r.run('pdf.merge', { files: [three, five] }))
    expect(path.basename(out!)).toBe('three (merged).pdf')
    const doc = await pdfOf(out!)
    expect(doc.getPageCount()).toBe(8)
    expect(doc.getPage(3).getSize().width).toBe(110)
  })

  it('pdf.split: ranges, every N, one per page, odd and even', async () => {
    const [ranges] = ok(await r.run('pdf.split', { files: [five], ranges: '1-2, 3-5' }))
    expect(path.basename(ranges!)).toBe('five')
    expect(fs.readdirSync(ranges!).sort()).toEqual(['five (pages 1-2).pdf', 'five (pages 3-5).pdf'])
    expect(await pageCount(path.join(ranges!, 'five (pages 3-5).pdf'))).toBe(3)

    const [every] = ok(await r.run('pdf.split', { files: [five], mode: 'every', every: 2 }))
    expect(fs.readdirSync(every!)).toHaveLength(3)

    const [pages] = ok(await r.run('pdf.split', { files: [five], mode: 'pages' }))
    expect(fs.readdirSync(pages!)).toHaveLength(5)

    const [oddEven] = ok(await r.run('pdf.split', { files: [five], mode: 'odd_even' }))
    expect(await pageCount(path.join(oddEven!, 'five (odd pages).pdf'))).toBe(3)
    expect(await pageCount(path.join(oddEven!, 'five (even pages).pdf'))).toBe(2)

    expect((await r.run('pdf.split', { files: [five], mode: 'ranges' })).error).toMatch(/Say which pages go in each file/)
  })

  it('pdf.rotate: turns only the chosen pages', async () => {
    const [out] = ok(await r.run('pdf.rotate', { files: [five], angle: 90, pages: 'odd' }))
    expect(path.basename(out!)).toBe('five (rotated).pdf')
    const doc = await pdfOf(out!)
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 0, 90, 0, 90])
    const [twice] = ok(await r.run('pdf.rotate', { files: [out!], angle: 270 }))
    expect((await pdfOf(twice!)).getPages().map((p) => p.getRotation().angle)).toEqual([0, 270, 0, 270, 0])
  })

  it('pdf.remove_pages: takes pages out, never all of them', async () => {
    const [out] = ok(await r.run('pdf.remove_pages', { files: [five], pages: '2,4' }))
    const doc = await pdfOf(out!)
    expect(doc.getPages().map((p) => p.getSize().width)).toEqual([110, 130, 150])
    expect((await r.run('pdf.remove_pages', { files: [three], pages: 'all' })).error).toMatch(/remove every page/)
  })

  it('pdf.extract_pages: keeps the chosen pages in the order written', async () => {
    const [out] = ok(await r.run('pdf.extract_pages', { files: [five], pages: '4, 1-2' }))
    expect(path.basename(out!)).toBe('five (extracted pages).pdf')
    expect((await pdfOf(out!)).getPages().map((p) => p.getSize().width)).toEqual([140, 110, 120])
    expect((await r.run('pdf.extract_pages', { files: [five], pages: 'x' })).error).toMatch(/“x” isn’t a list of pages/)
  })

  it('pdf.extract_images: JPGs as they are, other pictures rebuilt as PNG', async () => {
    const jpg = await makePicture(path.join(r.dir, 'shot.jpg'), 64, 48)
    const png = await sharp({ create: { width: 30, height: 20, channels: 4, background: { r: 0, g: 90, b: 200, alpha: 0.5 } } }).png().toBuffer()
    const doc = await PDFDocument.create()
    const page = doc.addPage([200, 200])
    page.drawImage(await doc.embedJpg(new Uint8Array(fs.readFileSync(jpg))), { x: 0, y: 0, width: 64, height: 48 })
    page.drawImage(await doc.embedPng(png), { x: 100, y: 100, width: 30, height: 20 })
    const file = path.join(r.dir, 'pics.pdf')
    fs.writeFileSync(file, await doc.save())

    const job = await r.run('pdf.extract_images', { files: [file] })
    const [folder] = ok(job)
    const names = fs.readdirSync(folder!).sort()
    expect(names).toHaveLength(2)
    const metas = await Promise.all(names.map((n) => sharp(path.join(folder!, n)).metadata()))
    expect(metas.map((m) => [m.format, m.width, m.height]).sort()).toEqual([
      ['jpeg', 64, 48],
      ['png', 30, 20],
    ])
    expect(job.note).toBeUndefined()

    expect((await r.run('pdf.extract_images', { files: [three] })).error).toMatch(/no pictures/)
  })

  it('pdf.flatten: form fields become page content', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 200])
    const field = doc.getForm().createTextField('name')
    field.setText('Harry')
    field.addToPage(page, { x: 20, y: 100, width: 200, height: 30 })
    const file = path.join(r.dir, 'form.pdf')
    fs.writeFileSync(file, await doc.save())

    const [out] = ok(await r.run('pdf.flatten', { files: [file] }))
    expect(path.basename(out!)).toBe('form (flattened).pdf')
    expect((await pdfOf(out!)).getForm().getFields()).toHaveLength(0)
  })

  it('fails in plain words on a damaged PDF', async () => {
    const bad = path.join(r.dir, 'bad.pdf')
    fs.writeFileSync(bad, 'not a pdf at all')
    expect((await r.run('pdf.rotate', { files: [bad] })).error).toMatch(/looks damaged/)
    expect((await r.run('pdf.to_images', { files: [bad] })).error).toMatch(/damaged/)
  })

  it('splits an each op into one job per file', async () => {
    const jobs = await r.engine.runOp('pdf.rotate', { files: [three, five], angle: 180 })
    expect(jobs.map((j) => j.status)).toEqual(['done', 'done'])
    expect(jobs[0]!.title).toBe('Rotate PDF pages: three.pdf')
  })
})
