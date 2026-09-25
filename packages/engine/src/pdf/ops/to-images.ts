// pdf.to_images: each page as a PNG, JPG or WEBP. One page gives one picture; more give a folder named after the PDF.
import { compressionInfo, isSinglePage, PDF_TEXT } from '@sparky/core'
import path from 'node:path'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { baseName, deliver, writeFile } from '../deliver'
import { renderPdfPages, type RenderedPage } from '../raster'
import { eachFile, isPdf, pagesField, pdfFilesField, pdfOp } from './common'

const FORMATS = ['png', 'jpg', 'webp'] as const
type Format = (typeof FORMATS)[number]

const input = z.object({
  files: pdfFilesField,
  format: z.enum(FORMATS).optional().meta(PDF_TEXT.fields.format),
  /** Dots per inch; 150 when left out. */
  dpi: z.number().min(1).optional().meta(PDF_TEXT.fields.dpi),
  pages: pagesField.optional().meta(PDF_TEXT.fields.imagePages),
  /** 1-100 for jpg and webp; the compression setting's image quality when left out. */
  quality: z.number().int().min(1).max(100).optional().meta(PDF_TEXT.fields.quality),
})

async function encode(png: Buffer, format: Format, quality: number, dpi: number): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  const img = sharp(png).withMetadata({ density: dpi })
  if (format === 'jpg') return img.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer()
  if (format === 'webp') return img.webp({ quality }).toBuffer()
  return img.png({ compressionLevel: 9 }).toBuffer()
}

export const toImagesOp: Op<typeof input> = {
  ...pdfOp('pdf.to_images', 'each'),
  input,
  targets: (ext) => (isPdf(ext) ? FORMATS.map((f) => ({ ext: f })) : []),
  many: (a) => !isSinglePage(a.pages),
  run(ctx, a) {
    const format = a.format ?? 'png'
    const dpi = a.dpi ?? 150
    const quality = a.quality ?? compressionInfo(ctx.settings().compression).imageQuality
    return eachFile(a.files, async (file) => {
      const pages = renderPdfPages(file, { dpi, pages: a.pages }, ctx.signal, (done, count) => ctx.progress({ fraction: done / count }))
      try {
        const first = await pages.next()
        if (first.done) throw new Error(PDF_TEXT.noPagesMatch(a.pages ?? ''))
        const p = first.value
        if (p.count === 1) {
          const suffix = p.total > 1 ? PDF_TEXT.pageSuffix(p.page, p.total) : ''
          return await deliver(ctx, { input: file, ext: format, category: 'image', suffix }, async (tmp) => writeFile(tmp, await encode(p.png, format, quality, dpi)))
        }
        const base = baseName(file)
        return await deliver(ctx, { input: file, ext: 'folder', category: 'image' }, async (dir) => {
          for (let r: IteratorResult<RenderedPage> = first; !r.done; r = await pages.next()) {
            const { page, total, png } = r.value
            await writeFile(path.join(dir, `${base}${PDF_TEXT.pageSuffix(page, total)}.${format}`), await encode(png, format, quality, dpi))
          }
        })
      } finally {
        await pages.return(undefined)
      }
    })
  },
}
