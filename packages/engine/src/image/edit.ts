// Resize, rotate, flip and re-encode one picture with sharp.
import { IMAGE_TEXT } from '@sparky/core'
import fs from 'node:fs/promises'
import type { Sharp } from 'sharp'
import { encodeBmp } from './bmp'
import { explainSharpError, readBytes } from './read'

export type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
export type EditExt = 'png' | 'jpg' | 'webp' | 'avif' | 'tiff' | 'bmp' | 'gif'

export interface EditOptions {
  width?: number
  height?: number
  percent?: number
  fit?: Fit
  rotate?: 90 | 180 | 270
  flip?: 'h' | 'v' | 'hv'
  stripMetadata?: boolean
  quality?: number
  lossless?: boolean
  background?: string
  output: EditExt
}

/** Formats without an alpha channel: transparent pixels are laid onto the background. */
const OPAQUE = new Set<EditExt>(['jpg', 'bmp'])

const hex = (c: string) => (c.startsWith('#') ? c : `#${c}`)

/** Frame times and loop count, set again when frames are joined back into one animation. */
interface Animation {
  delay?: number[]
  loop?: number
}

function encode(img: Sharp, o: EditOptions, anim: Animation = {}): Sharp {
  const q = o.quality
  switch (o.output) {
    case 'jpg':
      return img.jpeg({ quality: q ?? 90, mozjpeg: true })
    case 'webp':
      return img.webp(o.lossless ? { lossless: true, ...anim } : { quality: q ?? 90, ...anim })
    case 'avif':
      return img.avif(o.lossless ? { lossless: true } : { quality: q ?? 60 })
    case 'png':
      // A quality asks for a smaller palette PNG; without one PNG stays lossless.
      return img.png(q === undefined ? { compressionLevel: 9 } : { compressionLevel: 9, palette: true, quality: q })
    case 'tiff':
      return img.tiff(q === undefined ? { compression: 'lzw' } : { compression: 'jpeg', quality: q })
    case 'gif':
      return img.gif(anim)
    case 'bmp':
      return img
  }
}

/** Formats that hold every frame of a moving picture. */
const ANIMATED = new Set(['gif', 'webp'])

/** Returns a note for the finished job, when there is something to say. */
export async function editImage(input: string, output: string, o: EditOptions): Promise<string | undefined> {
  if (o.percent !== undefined && (o.width !== undefined || o.height !== undefined)) throw new Error(IMAGE_TEXT.sizeOrPercent)
  const { default: sharp } = await import('sharp')
  try {
    const bytes = await readBytes(input)
    const meta = await sharp(bytes).metadata()
    const moving = (meta.pages ?? 1) > 1 && ANIMATED.has(meta.format)
    const animated = moving && ANIMATED.has(o.output)
    const note = moving && !animated ? IMAGE_TEXT.firstFrameOnly(o.output) : undefined

    const turned = o.rotate === 90 || o.rotate === 270
    // sharp mirrors before it turns, whatever the call order. Mirroring the turned picture left to right is
    // the same as mirroring the original top to bottom when the turn is a quarter, so the axes swap.
    const flip = turned && o.flip !== 'hv' ? (o.flip === 'h' ? 'v' : o.flip === 'v' ? 'h' : undefined) : o.flip

    let { width, height } = o
    let fit: Fit = o.fit ?? 'inside'
    if (o.percent !== undefined) {
      const w = turned ? meta.autoOrient.height : meta.autoOrient.width
      const h = turned ? meta.autoOrient.width : meta.autoOrient.height
      width = Math.round((w * o.percent) / 100)
      height = Math.round((h * o.percent) / 100)
      fit = 'fill'
      if (width < 1 || height < 1) throw new Error(IMAGE_TEXT.tooSmall)
    }

    const shape = (from: Sharp): Sharp => {
      let img = from.autoOrient()
      if (o.rotate) img = img.rotate(o.rotate)
      if (flip === 'v' || flip === 'hv') img = img.flip()
      if (flip === 'h' || flip === 'hv') img = img.flop()
      if (width || height) img = img.resize({ width, height, fit })
      if (OPAQUE.has(o.output) || o.background) img = img.flatten({ background: hex(o.background ?? '#ffffff') })
      return img
    }

    let img: Sharp
    let anim: Animation = {}
    if (animated && o.rotate) {
      // sharp can't turn a multi-frame picture, so each frame is turned alone and the frames joined again.
      const frames: Buffer[] = []
      for (let page = 0; page < (meta.pages ?? 1); page++) frames.push(await shape(sharp(bytes, { page })).png({ compressionLevel: 0 }).toBuffer())
      img = sharp(frames, { join: { animated: true } })
      anim = { delay: meta.delay, loop: meta.loop }
    } else {
      img = shape(sharp(bytes, { animated }))
    }
    if (!o.stripMetadata) img = img.withMetadata()

    if (o.output === 'bmp') {
      const { data, info } = await img.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
      await fs.writeFile(output, encodeBmp(data, info.width, info.height))
      return note
    }
    await encode(img, o, anim).toFile(output)
    return note
  } catch (e) {
    throw explainSharpError(input, e)
  }
}
