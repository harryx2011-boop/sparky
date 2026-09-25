import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inputSchema, opById, RESERVED_INPUTS } from '../../src'
import { imageOps } from '../../src/ops/image'
import { ocrOps } from '../../src/ops/ocr'
import { harness, type Harness } from './harness'

describe('image and ocr op declarations', () => {
  it('registers each op with a flat JSON schema, the engine’s out field and no reserved names', () => {
    for (const op of [...imageOps, ...ocrOps]) {
      expect(opById(op.id)).toBe(op)
      expect(op.kind).toBe('tool')
      expect(op.positional).toEqual(['files'])
      expect(op.paths).toEqual(['files'])
      const js = inputSchema(op)
      expect(js.type).toBe('object')
      const props = js.properties as Record<string, { title?: string; description?: string }>
      expect(Object.keys(props)).toContain('out')
      expect(JSON.stringify(js)).not.toContain(String(Number.MAX_SAFE_INTEGER))
      for (const name of RESERVED_INPUTS) expect(Object.keys(op.input.shape), `${op.id}.${name}`).not.toContain(name)
      // The Tools page labels each field with its title and explains it with its description.
      for (const key of Object.keys(op.input.shape)) {
        expect(props[key]?.title, `${op.id}.${key} title`).toBeTruthy()
        expect(props[key]?.description, `${op.id}.${key} description`).toBeTruthy()
      }
    }
    expect(imageOps.map((o) => [o.id, o.category, o.arity])).toEqual([
      ['image.edit', 'image', 'each'],
      ['image.ico', 'image', 'each'],
      ['image.gif', 'image', 'all'],
    ])
    expect(ocrOps.map((o) => [o.id, o.category, o.arity])).toEqual([['ocr', 'tool', 'each']])
  })

  it('declares every on/off field’s default, since a form starts an unset switch as off', () => {
    const defaults: Record<string, unknown> = {}
    for (const op of [...imageOps, ...ocrOps]) {
      const props = inputSchema(op).properties as Record<string, { type?: string; default?: unknown }>
      for (const [key, p] of Object.entries(props)) {
        if (p.type !== 'boolean') continue
        expect(p, `${op.id}.${key}`).toHaveProperty('default')
        defaults[`${op.id}.${key}`] = p.default
      }
    }
    expect(defaults).toEqual({ 'image.edit.stripMetadata': false, 'image.edit.lossless': false, 'image.gif.loop': true })
  })

  it('gives every choice of a pick-one field its own words', () => {
    const checked: string[] = []
    for (const op of [...imageOps, ...ocrOps]) {
      const props = inputSchema(op).properties as Record<string, { enum?: unknown[]; anyOf?: { const?: unknown }[]; labels?: Record<string, string> }>
      for (const [key, p] of Object.entries(props)) {
        const values = p.enum ?? (p.anyOf?.every((x) => 'const' in x) ? p.anyOf.map((x) => x.const) : undefined)
        if (!values) continue
        checked.push(`${op.id}.${key}`)
        expect(Object.keys(p.labels ?? {}).sort(), `${op.id}.${key}`).toEqual(values.map(String).sort())
      }
    }
    expect(checked.sort()).toEqual(['image.edit.fit', 'image.edit.flip', 'image.edit.output', 'image.edit.rotate', 'ocr.output'])
  })

  it('accepts only pictures sharp opens (OCR also takes BMP and PDF)', () => {
    const edit = opById('image.edit')!
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'tif', 'tiff']) expect(edit.accepts(ext), ext).toBe(true)
    for (const ext of ['heic', 'bmp', 'pdf', 'mp4', 'txt']) expect(edit.accepts(ext), ext).toBe(false)
    expect(opById('ocr')!.accepts('bmp')).toBe(true)
    expect(opById('ocr')!.accepts('pdf')).toBe(true)
    expect(opById('ocr')!.accepts('docx')).toBe(false)
  })
})

describe('image.edit', () => {
  let h: Harness
  let wide: string
  let halves: string
  let clear: string
  let photo: string

  beforeAll(async () => {
    h = await harness('image-edit')
    wide = path.join(h.dir, 'wide.png')
    await sharp({ create: { width: 400, height: 200, channels: 3, background: '#336699' } }).png().toFile(wide)
    // Left half red, right half blue.
    halves = path.join(h.dir, 'halves.png')
    const red = await sharp({ create: { width: 50, height: 40, channels: 3, background: '#ff0000' } }).png().toBuffer()
    await sharp({ create: { width: 100, height: 40, channels: 3, background: '#0000ff' } }).composite([{ input: red, left: 0, top: 0 }]).png().toFile(halves)
    clear = path.join(h.dir, 'clear.png')
    await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(clear)
    photo = path.join(h.dir, 'photo.jpg')
    await sharp({ create: { width: 64, height: 48, channels: 3, background: '#808080' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'Sparky test' } } })
      .jpeg()
      .toFile(photo)
  })
  afterAll(() => h?.close())

  const edit = async (args: Record<string, unknown>) => {
    const [job] = await h.engine.runOp('image.edit', args)
    return job!
  }
  const done = async (args: Record<string, unknown>) => {
    const job = await edit(args)
    expect(job.error).toBeUndefined()
    expect(job.status).toBe('done')
    return job.outputs![0]!
  }
  const pixel = async (file: string, x: number, y: number) => {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
    const at = (y * info.width + x) * info.channels
    return [...data.subarray(at, at + 3)]
  }

  it('resizes by width, keeping the shape, into the same format', async () => {
    const out = await done({ files: [wide], width: 100 })
    expect(path.extname(out)).toBe('.png')
    expect(await sharp(out).metadata()).toMatchObject({ width: 100, height: 50, format: 'png' })
  })

  it('resizes by percent', async () => {
    expect(await sharp(await done({ files: [wide], percent: 50 })).metadata()).toMatchObject({ width: 200, height: 100 })
    expect(await sharp(await done({ files: [wide], percent: 250 })).metadata()).toMatchObject({ width: 1000, height: 500 })
  })

  it('fits a box by each fit mode', async () => {
    const size = async (fit: string) => {
      const m = await sharp(await done({ files: [wide], width: 100, height: 100, fit })).metadata()
      return [m.width, m.height]
    }
    expect(await size('inside')).toEqual([100, 50])
    expect(await size('cover')).toEqual([100, 100])
    expect(await size('contain')).toEqual([100, 100])
    expect(await size('fill')).toEqual([100, 100])
    expect(await size('outside')).toEqual([200, 100])
  })

  it('rotates before resizing, and flips', async () => {
    expect(await sharp(await done({ files: [wide], rotate: 90, width: 100 })).metadata()).toMatchObject({ width: 100, height: 200 })
    expect(await sharp(await done({ files: [wide], rotate: 270, percent: 50 })).metadata()).toMatchObject({ width: 100, height: 200 })
    expect(await pixel(halves, 0, 0)).toEqual([255, 0, 0])
    expect(await pixel(await done({ files: [halves], flip: 'h' }), 0, 0)).toEqual([0, 0, 255])
    expect(await pixel(await done({ files: [halves], flip: 'v' }), 0, 0)).toEqual([255, 0, 0])
    expect(await pixel(await done({ files: [halves], flip: 'hv' }), 0, 0)).toEqual([0, 0, 255])
  })

  it('turns first, then mirrors the turned picture', async () => {
    // Quarters: red top-left, green top-right, blue bottom-left, white bottom-right.
    const quad = path.join(h.dir, 'quad.png')
    const block = (background: string) => sharp({ create: { width: 20, height: 20, channels: 3, background } }).png().toBuffer()
    await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ffffff' } })
      .composite([
        { input: await block('#ff0000'), left: 0, top: 0 },
        { input: await block('#00ff00'), left: 20, top: 0 },
        { input: await block('#0000ff'), left: 0, top: 20 },
      ])
      .png()
      .toFile(quad)
    const corners = async (file: string) => [await pixel(file, 5, 5), await pixel(file, 35, 5), await pixel(file, 5, 35), await pixel(file, 35, 35)]
    const R = [255, 0, 0]
    const G = [0, 255, 0]
    const B = [0, 0, 255]
    const W = [255, 255, 255]
    // 90° clockwise: blue red / white green. Then left-right: red blue / green white.
    expect(await corners(await done({ files: [quad], rotate: 90, flip: 'h' }))).toEqual([R, B, G, W])
    // Then top-bottom instead: white green / blue red.
    expect(await corners(await done({ files: [quad], rotate: 90, flip: 'v' }))).toEqual([W, G, B, R])
    // 270°: green white / red blue, then left-right: white green / blue red.
    expect(await corners(await done({ files: [quad], rotate: 270, flip: 'h' }))).toEqual([W, G, B, R])
    // 180°: white blue / green red, then left-right: blue white / red green.
    expect(await corners(await done({ files: [quad], rotate: 180, flip: 'h' }))).toEqual([B, W, R, G])
  })

  it('keeps every frame of an animation it saves as GIF or WEBP, and says so when the format holds only one', async () => {
    const anim = path.join(h.dir, 'anim.gif')
    const frame = (background: string) => sharp({ create: { width: 40, height: 30, channels: 3, background } }).png().toBuffer()
    await sharp([await frame('#ff0000'), await frame('#00ff00'), await frame('#0000ff')], { join: { animated: true } })
      .gif({ delay: [100, 200, 300], loop: 0 })
      .toFile(anim)
    const gif = await done({ files: [anim], width: 20, rotate: 90 })
    expect(await sharp(gif, { animated: true }).metadata()).toMatchObject({ format: 'gif', pages: 3, width: 20, pageHeight: 27, delay: [100, 200, 300], loop: 0 })
    const webp = await done({ files: [anim], output: 'webp' })
    expect(await sharp(webp, { animated: true }).metadata()).toMatchObject({ format: 'webp', pages: 3, width: 40, pageHeight: 30 })

    const [still] = await h.engine.runOp('image.edit', { files: [anim], output: 'png' })
    expect(still).toMatchObject({ status: 'done', note: 'This picture moves, but PNG holds one picture, so only the first frame was saved.' })
    expect(await pixel(still!.outputs![0]!, 5, 5)).toEqual([255, 0, 0])
  })

  it('keeps metadata unless asked to strip it', async () => {
    const kept = await sharp(await done({ files: [photo], width: 32 })).metadata()
    expect(kept.exif?.toString('latin1')).toContain('Sparky test')
    const stripped = await sharp(await done({ files: [photo], width: 32, stripMetadata: true })).metadata()
    expect(stripped.exif).toBeUndefined()
  })

  it('lays transparency onto the background for JPG and BMP', async () => {
    const jpg = await done({ files: [clear], output: 'jpg', background: '#00ff00' })
    const [r, g, b] = await pixel(jpg, 10, 10)
    expect(r).toBeLessThan(10)
    expect(g).toBeGreaterThan(245)
    expect(b).toBeLessThan(10)
    expect(await pixel(await done({ files: [clear], output: 'jpg' }), 10, 10)).toEqual([255, 255, 255])

    const bmp = fs.readFileSync(await done({ files: [halves], output: 'bmp', background: 'ff00ff' }))
    expect(bmp.subarray(0, 2).toString('ascii')).toBe('BM')
    expect(bmp.readUInt32LE(2)).toBe(bmp.length)
    expect([bmp.readInt32LE(18), bmp.readInt32LE(22), bmp.readUInt16LE(28)]).toEqual([100, 40, 24])
    // Bottom-up rows, BGR: the first stored pixel is the bottom-left one, red.
    expect([...bmp.subarray(54, 57)]).toEqual([0, 0, 255])
    // 100 × 3 = 300 bytes a row, already a multiple of 4.
    expect(bmp.length).toBe(54 + 300 * 40)
  })

  it('writes lossless WEBP and AVIF exactly, and TIFF and GIF', async () => {
    const pixels = (file: string) => sharp(file).removeAlpha().raw().toBuffer()
    const webp = await done({ files: [halves], output: 'webp', lossless: true })
    expect(await pixels(webp)).toEqual(await pixels(halves))
    expect((await sharp(await done({ files: [halves], output: 'avif', lossless: true })).metadata()).format).toBe('heif')
    expect((await sharp(await done({ files: [halves], output: 'tiff' })).metadata()).format).toBe('tiff')
    expect((await sharp(await done({ files: [halves], output: 'gif' })).metadata()).format).toBe('gif')
  })

  it('lowers quality when asked', async () => {
    const noisy = path.join(h.dir, 'noisy.png')
    await sharp({ create: { width: 200, height: 200, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).png().toFile(noisy)
    const hi = fs.statSync(await done({ files: [noisy], output: 'jpg', quality: 100 })).size
    const lo = fs.statSync(await done({ files: [noisy], output: 'jpg', quality: 5 })).size
    expect(lo).toBeLessThan(hi)
  })

  it('splits a batch into one job per picture, each with its own output', async () => {
    const jobs = await h.engine.runOp('image.edit', { files: [wide, halves], width: 10, out: path.join(h.dir, 'batch') + path.sep })
    expect(jobs.map((j) => j.status)).toEqual(['done', 'done'])
    expect(jobs.map((j) => path.basename(j.outputs![0]!))).toEqual(['wide.png', 'halves.png'])
    expect(jobs[0]!.title).toBe('Edit wide.png → PNG')
  })

  it('refuses in plain words', async () => {
    expect(await edit({ files: [wide], width: 10, percent: 50 })).toMatchObject({ status: 'failed', error: 'Give a width and height, or a percentage, not both.' })
    const text = path.join(h.dir, 'notes.txt')
    fs.writeFileSync(text, 'hello')
    expect((await edit({ files: [text] })).error).toMatch(/can’t read notes\.txt as a picture/)
    const fake = path.join(h.dir, 'fake.png')
    fs.writeFileSync(fake, 'not a png at all')
    expect((await edit({ files: [fake] })).error).toMatch(/fake\.png looks damaged/)
    expect((await edit({ files: [path.join(h.dir, 'missing.png')] })).error).toMatch(/file is gone/)
    expect(() => h.engine.startOp('image.edit', { files: [wide], rotate: 45 })).toThrow(/rotate/)
    expect(() => h.engine.startOp('image.edit', { files: [wide], background: 'blue' })).toThrow(/background/)
  })
})
