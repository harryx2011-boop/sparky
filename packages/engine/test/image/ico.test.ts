import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeIco } from '../../src/image/ico'
import { harness, type Harness } from './harness'

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('encodeIco', () => {
  it('writes ICONDIR, one ICONDIRENTRY per frame and the PNGs after them', () => {
    const a = Buffer.concat([PNG_SIG, Buffer.from('aaaa')])
    const b = Buffer.concat([PNG_SIG, Buffer.from('bbbbbb')])
    const ico = encodeIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ])
    // ICONDIR: reserved 0, type 1 (icon), 2 images.
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 2, 0])
    // First entry: 16×16, no palette, reserved, 1 plane, 32 bits, size, offset right after the 6 + 2×16 header bytes.
    expect(ico.readUInt8(6)).toBe(16)
    expect(ico.readUInt8(7)).toBe(16)
    expect(ico.readUInt8(8)).toBe(0)
    expect(ico.readUInt8(9)).toBe(0)
    expect(ico.readUInt16LE(10)).toBe(1)
    expect(ico.readUInt16LE(12)).toBe(32)
    expect(ico.readUInt32LE(14)).toBe(a.length)
    expect(ico.readUInt32LE(18)).toBe(38)
    // 256 is stored as 0.
    expect(ico.readUInt8(22)).toBe(0)
    expect(ico.readUInt8(23)).toBe(0)
    expect(ico.readUInt32LE(30)).toBe(b.length)
    expect(ico.readUInt32LE(34)).toBe(38 + a.length)
    expect(ico.subarray(38, 38 + a.length)).toEqual(a)
    expect(ico.subarray(38 + a.length)).toEqual(b)
    expect(ico.length).toBe(38 + a.length + b.length)
  })
})

describe('image.ico', () => {
  let h: Harness
  let src: string
  beforeAll(async () => {
    h = await harness('ico')
    src = path.join(h.dir, 'logo.png')
    await sharp({ create: { width: 300, height: 150, channels: 4, background: '#b6f04a' } }).png().toFile(src)
  })
  afterAll(() => h?.close())

  const frames = (file: string) => {
    const ico = fs.readFileSync(file)
    const count = ico.readUInt16LE(4)
    return Array.from({ length: count }, (_, i) => {
      const at = 6 + 16 * i
      const png = ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8))
      return { edge: ico.readUInt8(at), png }
    })
  }

  it('packs 16, 32, 48 and 256 by default, each a square PNG', async () => {
    const [job] = await h.engine.runOp('image.ico', { files: [src] })
    expect(job).toMatchObject({ status: 'done', kind: 'tool', op: 'image.ico' })
    const out = job!.outputs![0]!
    expect(path.extname(out)).toBe('.ico')
    const f = frames(out)
    expect(f.map((x) => x.edge)).toEqual([16, 32, 48, 0])
    for (const [i, size] of [16, 32, 48, 256].entries()) {
      expect(f[i]!.png.subarray(0, 8)).toEqual(PNG_SIG)
      expect(await sharp(f[i]!.png).metadata()).toMatchObject({ width: size, height: size, hasAlpha: true })
    }
  })

  it('takes any set of sizes, sorted and without repeats, into the caller’s file', async () => {
    const out = path.join(h.dir, 'custom', 'app.ico')
    const [job] = await h.engine.runOp('image.ico', { files: [src], sizes: [64, 24, 64, 256], out })
    expect(job).toMatchObject({ status: 'done', outputs: [out] })
    const f = frames(out)
    expect(f.map((x) => x.edge)).toEqual([24, 64, 0])
    expect((await sharp(f[2]!.png).metadata()).width).toBe(256)
  })

  it('refuses sizes the ICO format has no room for, saying why', () => {
    expect(() => h.engine.startOp('image.ico', { files: [src], sizes: [32, 512] })).toThrow(/ICO format/)
  })
})
