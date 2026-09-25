// pdf.protect: a copy of the PDF that asks for a password, limits printing and copying, or both. Needs Ghostscript.
import { PDF_TEXT } from '@sparky/core'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { deliver } from '../deliver'
import { protectArgs, runGhostscript } from '../ghostscript'
import { eachFile, needGhostscript, pdfFilesField, pdfOp } from './common'

const input = z.object({
  files: pdfFilesField,
  /** Asked for when the PDF is opened. */
  userPassword: z.string().min(1).optional().meta(PDF_TEXT.fields.userPassword),
  /** Lifts the print and copy limits. A random one is set when left out. */
  ownerPassword: z.string().min(1).optional().meta(PDF_TEXT.fields.ownerPassword),
  /** true when left out. */
  allowPrint: z.boolean().default(true).meta(PDF_TEXT.fields.allowPrint),
  /** true when left out. */
  allowCopy: z.boolean().default(true).meta(PDF_TEXT.fields.allowCopy),
})

export const protectOp: Op<typeof input> = {
  ...pdfOp('pdf.protect', 'each'),
  input,
  requires: ['ghostscript'],
  secret: ['userPassword', 'ownerPassword'],
  run(ctx, a) {
    const gs = needGhostscript(ctx, 'pdf.protect')
    if (!a.userPassword && !a.ownerPassword) throw new Error(PDF_TEXT.protectNeedsPassword)
    const opts = { userPassword: a.userPassword, ownerPassword: a.ownerPassword, print: a.allowPrint, copy: a.allowCopy }
    return eachFile(a.files, (file) => {
      ctx.progress({ fraction: null })
      return deliver(ctx, { input: file, ext: 'pdf', category: 'document', suffix: PDF_TEXT.suffix.protected }, async (tmp) => {
        await runGhostscript(gs, protectArgs(file, tmp, opts), { signal: ctx.signal, tempDir: ctx.tempDir, intent: 'protect' })
      })
    })
  },
}
