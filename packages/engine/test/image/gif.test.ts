import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { harness, type Harness } from './harness'

describe('image.gif', () => {
  let h: Harness
  let frames: string[]
  beforeAll(async () => {
    h = await harness('image-gif')
    frames = []
    const specs = [
      ['#ff0000', 80, 60, 'png'],
      ['#00ff00', 160, 120, 'jpg'],
      ['#0000ff', 60, 80, 'webp'],
    ] as const
    for (const [i, [colour, w, hgt, ext]] of specs.entries()) {
      const file = path.join(h.dir, `frame${i}.${ext}`)
      await sharp({ create: { width: w, height: hgt, channels: 3, background: colour } }).toFile(file)
      frames.push(file)
    }
  })
  afterAll(() => h?.close())

  it('makes one looping GIF from every picture, sized to the first', async () => {
    const jobs = await h.engine.runOp('image.gif', { files: frames, delayMs: 250 })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ status: 'done', title: 'frame0.png and 2 more → GIF' })
    const out = jobs[0]!.outputs![0]!
    expect(path.basename(out)).toBe('frame0.gif')
    const m = await sharp(out, { animated: true }).metadata()
    expect(m).toMatchObject({ format: 'gif', pages: 3, width: 80, pageHeight: 60, loop: 0 })
    expect(m.delay).toEqual([250, 250, 250])
  })

  it('defaults to half a second a frame, plays once when loop is off, and takes a width', async () => {
    const [job] = await h.engine.runOp('image.gif', { files: frames, loop: false, width: 40 })
    const m = await sharp(job!.outputs![0]!, { animated: true }).metadata()
    expect(m).toMatchObject({ pages: 3, width: 40, pageHeight: 30 })
    expect(m.delay).toEqual([500, 500, 500])
    expect(m.loop).not.toBe(0)
  })
})
