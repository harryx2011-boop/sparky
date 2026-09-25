// Pictures into one animated GIF with sharp: every frame is fitted to the first picture's shape, then libvips' GIF writer (cgif + libimagequant) builds the palette.
import fs from 'node:fs/promises'
import { throwIfAborted } from '../process'
import { explainSharpError, readBytes } from './read'

export interface GifOptions {
  delayMs: number
  loop: boolean
  width?: number
}

export async function makeGif(inputs: readonly string[], output: string, o: GifOptions, signal: AbortSignal, progress: (fraction: number) => void): Promise<void> {
  const { default: sharp } = await import('sharp')
  const first = inputs[0]!
  const meta = await sharp(await readBytes(first)).metadata().catch((e) => {
    throw explainSharpError(first, e)
  })
  const width = o.width ?? meta.autoOrient.width
  const height = Math.max(1, Math.round((meta.autoOrient.height * width) / meta.autoOrient.width))

  const frames: Buffer[] = []
  for (const [i, file] of inputs.entries()) {
    throwIfAborted(signal)
    const frame = await sharp(await readBytes(file), { animated: false })
      .autoOrient()
      .resize({ width, height, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png({ compressionLevel: 0 })
      .toBuffer()
      .catch((e) => {
        throw explainSharpError(file, e)
      })
    frames.push(frame)
    progress(((i + 1) / inputs.length) * 0.8)
  }
  throwIfAborted(signal)
  const gif = await sharp(frames, { join: { animated: true } })
    // loop 0 plays forever; 1 plays once.
    .gif({ delay: frames.map(() => o.delayMs), loop: o.loop ? 0 : 1, keepDuplicateFrames: true })
    .toBuffer()
  await fs.writeFile(output, gif)
}
