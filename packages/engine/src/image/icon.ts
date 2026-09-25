// A picture made square at each requested size, packed into one .ico.
import fs from 'node:fs/promises'
import { throwIfAborted } from '../process'
import { encodeIco } from './ico'
import { explainSharpError, readBytes } from './read'

export const DEFAULT_ICO_SIZES = [16, 32, 48, 256] as const

export async function makeIcon(input: string, output: string, sizes: readonly number[], signal: AbortSignal): Promise<void> {
  const { default: sharp } = await import('sharp')
  const edges = [...new Set(sizes)].sort((a, b) => a - b)
  const bytes = await readBytes(input)
  const frames = []
  try {
    for (const size of edges) {
      throwIfAborted(signal)
      const png = await sharp(bytes, { animated: false })
        .autoOrient()
        // Letterboxed on transparency, so a wide logo keeps its shape.
        .resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .png({ compressionLevel: 9 })
        .toBuffer()
      frames.push({ size, png })
    }
  } catch (e) {
    throw explainSharpError(input, e)
  }
  await fs.writeFile(output, encodeIco(frames))
}
