// pdf.merge: PDFs one after another, in the order given, into one file.
import { PDF_TEXT } from '@sparky/core'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod/v4'
import { throwIfAborted } from '../../process'
import type { Op } from '../../ops/types'
import { deliver } from '../deliver'
import { loadPdf, savePdf } from '../document'
import { filesField, pdfOp } from './common'

const input = z.object({ files: filesField.meta(PDF_TEXT.fields.mergeFiles) })

export const mergeOp: Op<typeof input> = {
  ...pdfOp('pdf.merge', 'all'),
  input,
  async run(ctx, a) {
    const doc = await PDFDocument.create()
    for (const [i, file] of a.files.entries()) {
      throwIfAborted(ctx.signal)
      const src = await loadPdf(file)
      for (const page of await doc.copyPages(src, src.getPageIndices())) doc.addPage(page)
      ctx.progress({ fraction: (i + 1) / a.files.length })
    }
    return { outputs: [await deliver(ctx, { input: a.files[0], ext: 'pdf', category: 'document', suffix: PDF_TEXT.suffix.merged }, (tmp) => savePdf(doc, tmp))] }
  },
}
