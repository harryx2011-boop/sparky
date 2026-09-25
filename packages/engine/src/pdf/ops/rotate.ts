// pdf.rotate: turns the chosen pages clockwise.
import { parsePageRanges, PDF_TEXT } from '@sparky/core'
import { degrees } from 'pdf-lib'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { throwIfAborted } from '../../process'
import { editPdf, eachFile, pagesField, pdfFilesField, pdfOp } from './common'

const rotateInput = z.object({
  files: pdfFilesField,
  /** Clockwise, added to each page's current turn; 90 when left out. */
  angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional().meta(PDF_TEXT.fields.angle),
  /** Which pages turn; every page when left out. Takes "odd" and "even" too. */
  pages: pagesField.optional().meta(PDF_TEXT.fields.rotatePages),
})

export const rotateOp: Op<typeof rotateInput> = {
  ...pdfOp('pdf.rotate', 'each'),
  input: rotateInput,
  run(ctx, a) {
    const angle = a.angle ?? 90
    return eachFile(a.files, (file) =>
      editPdf(ctx, file, PDF_TEXT.suffix.rotated, async (doc) => {
        const pages = parsePageRanges(a.pages ?? '', doc.getPageCount())
        for (const [i, n] of pages.entries()) {
          throwIfAborted(ctx.signal)
          const page = doc.getPage(n - 1)
          page.setRotation(degrees((((page.getRotation().angle + angle) % 360) + 360) % 360))
          ctx.progress({ fraction: (i + 1) / pages.length })
        }
      }),
    )
  },
}
