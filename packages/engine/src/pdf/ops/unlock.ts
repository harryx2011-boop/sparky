// pdf.unlock: a copy of the PDF with its password and limits removed. Needs Ghostscript and, for a PDF that asks for one, the password.
import { PDF_TEXT } from '@sparky/core'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { deliver } from '../deliver'
import { runGhostscript, unlockArgs } from '../ghostscript'
import { eachFile, needGhostscript, pdfFilesField, pdfOp } from './common'

const input = z.object({
  files: pdfFilesField,
  /** The password that opens the PDF. A PDF that only limits printing or copying opens without one. */
  password: z.string().min(1).optional().meta(PDF_TEXT.fields.password),
})

export const unlockOp: Op<typeof input> = {
  ...pdfOp('pdf.unlock', 'each'),
  input,
  requires: ['ghostscript'],
  secret: ['password'],
  run(ctx, a) {
    const gs = needGhostscript(ctx, 'pdf.unlock')
    return eachFile(a.files, (file) => {
      ctx.progress({ fraction: null })
      return deliver(ctx, { input: file, ext: 'pdf', category: 'document', suffix: PDF_TEXT.suffix.unlocked }, async (tmp) => {
        await runGhostscript(gs, unlockArgs(file, tmp, a.password), { signal: ctx.signal, tempDir: ctx.tempDir, intent: 'unlock', password: Boolean(a.password) })
      })
    })
  },
}
