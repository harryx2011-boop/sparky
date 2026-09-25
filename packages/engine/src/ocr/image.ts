// Pictures tesseract is handed: anything sharp opens becomes an upright PNG; BMP goes in as it is. PDFs are drawn page by page in ./pdf.
import { normalizeExt } from '@sparky/core'
import fs from 'node:fs/promises'
import { explainSharpError, readBytes, readsWithSharp } from '../image/read'

export const isOcrPdf = (ext: string) => normalizeExt(ext) === 'pdf'

export const readsForOcr = (ext: string) => readsWithSharp(ext) || normalizeExt(ext) === 'bmp' || isOcrPdf(ext)

export async function ocrImage(file: string): Promise<Buffer> {
  if (!readsWithSharp(file)) return fs.readFile(file)
  const { default: sharp } = await import('sharp')
  return sharp(await readBytes(file), { animated: false })
    .autoOrient()
    .png({ compressionLevel: 1 })
    .toBuffer()
    .catch((e) => {
      throw explainSharpError(file, e)
    })
}
