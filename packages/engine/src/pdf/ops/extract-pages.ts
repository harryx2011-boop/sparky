// pdf.extract_pages: a new PDF of only the chosen pages, in the order written.
import { parsePageRanges, PDF_TEXT } from '@sparky/core'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { throwIfAborted } from '../../process'
import { editPdf, eachFile, pagesField, pdfFilesField, pdfOp } from './common'

const extractInput = z.object({
  files: pdfFilesField,
  /** The pages to keep, in the order written, so "3,1,2" also reorders them. */
  pages: pagesField.min(1).meta(PDF_TEXT.fields.extractPages),
})

export const extractPagesOp: Op<typeof extractInput> = {
  ...pdfOp('pdf.extract_pages', 'each'),
  input: extractInput,
  run(ctx, a) {
    return eachFile(a.files, (file) =>
      editPdf(ctx, file, PDF_TEXT.suffix.extracted, async (doc) => {
        const keep = parsePageRanges(a.pages, doc.getPageCount())
        const out = await PDFDocument.create()
        const copied = await out.copyPages(doc, keep.map((n) => n - 1))
        for (const [i, page] of copied.entries()) {
          throwIfAborted(ctx.signal)
          out.addPage(page)
          ctx.progress({ fraction: (i + 1) / copied.length })
        }
        return out
      }),
    )
  },
}
