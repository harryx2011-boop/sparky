// pdf.remove_pages: a copy of the PDF without the chosen pages.
import { parsePageRanges, PDF_TEXT } from '@sparky/core'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { throwIfAborted } from '../../process'
import { editPdf, eachFile, pagesField, pdfFilesField, pdfOp } from './common'

const removeInput = z.object({
  files: pdfFilesField,
  /** The pages to take out. */
  pages: pagesField.min(1).meta(PDF_TEXT.fields.removePages),
})

export const removePagesOp: Op<typeof removeInput> = {
  ...pdfOp('pdf.remove_pages', 'each'),
  input: removeInput,
  run(ctx, a) {
    return eachFile(a.files, (file) =>
      editPdf(ctx, file, PDF_TEXT.suffix.removed, async (doc) => {
        const total = doc.getPageCount()
        const gone = parsePageRanges(a.pages, total).sort((x, y) => y - x)
        if (gone.length >= total) throw new Error(PDF_TEXT.removeAll)
        // Last first, so the earlier page numbers still point at the same pages.
        for (const [i, n] of gone.entries()) {
          throwIfAborted(ctx.signal)
          doc.removePage(n - 1)
          ctx.progress({ fraction: (i + 1) / gone.length })
        }
      }),
    )
  },
}
