// pdf.from_images: pictures into one PDF, or one PDF per picture.
import { normalizeExt, PDF_TEXT } from '@sparky/core'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod/v4'
import { throwIfAborted } from '../../process'
import type { Op } from '../../ops/types'
import { breathe, deliver } from '../deliver'
import { savePdf } from '../document'
import { addPicturePage, PICTURE_INPUTS } from '../images'
import type { LayoutOptions } from '../layout'
import { filesField, pdfOp } from './common'

const input = z.object({
  files: filesField.meta(PDF_TEXT.fields.pictures),
  /** 'fit' (default) makes each page the picture's own size at its DPI. */
  pageSize: z.enum(['fit', 'a4', 'a3', 'letter', 'legal']).optional().meta(PDF_TEXT.fields.pageSize),
  orientation: z.enum(['auto', 'portrait', 'landscape']).optional().meta(PDF_TEXT.fields.orientation),
  marginMm: z.number().min(0).optional().meta(PDF_TEXT.fields.marginMm),
  fit: z.enum(['contain', 'cover']).optional().meta(PDF_TEXT.fields.fit),
  /** true (default): one PDF for all the pictures; false: one PDF per picture. */
  merge: z.boolean().default(true).meta(PDF_TEXT.fields.merge),
})

export const fromImagesOp: Op<typeof input> = {
  ...pdfOp('pdf.from_images', 'all', (ext) => PICTURE_INPUTS.has(normalizeExt(ext))),
  input,
  targets: () => [{ ext: 'pdf' }],
  many: (a) => a.merge === false && a.files.length > 1,
  async run(ctx, a) {
    const layout: LayoutOptions = { pageSize: a.pageSize ?? 'fit', orientation: a.orientation ?? 'auto', marginMm: a.marginMm ?? 0, fit: a.fit ?? 'contain' }
    const n = a.files.length
    if (a.merge === false) {
      const outputs: string[] = []
      for (const [i, file] of a.files.entries()) {
        await breathe()
        throwIfAborted(ctx.signal)
        const doc = await PDFDocument.create()
        await addPicturePage(doc, file, layout)
        outputs.push(await deliver(ctx, { input: file, ext: 'pdf', category: 'document' }, (tmp) => savePdf(doc, tmp)))
        ctx.progress({ fraction: (i + 1) / n })
      }
      return { outputs }
    }
    const doc = await PDFDocument.create()
    for (const [i, file] of a.files.entries()) {
      await breathe()
      throwIfAborted(ctx.signal)
      await addPicturePage(doc, file, layout)
      ctx.progress({ fraction: (i + 1) / n })
    }
    const suffix = n > 1 ? PDF_TEXT.suffix.images : ''
    return { outputs: [await deliver(ctx, { input: a.files[0], ext: 'pdf', category: 'document', suffix }, (tmp) => savePdf(doc, tmp))] }
  },
}
