// pdf.flatten: form fields become plain page content. With Ghostscript installed, annotations are drawn into the page too.
import { PDF_TEXT } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import type { Op } from '../../ops/types'
import { throwIfAborted } from '../../process'
import { deliver } from '../deliver'
import { loadPdf, savePdf } from '../document'
import { flattenArgs, runGhostscript } from '../ghostscript'
import { eachFile, pdfFilesField, pdfOp } from './common'

const input = z.object({ files: pdfFilesField })

export const flattenOp: Op<typeof input> = {
  ...pdfOp('pdf.flatten', 'each'),
  input,
  run(ctx, a) {
    const gs = ctx.tools.ghostscript
    return eachFile(a.files, async (file) => {
      ctx.progress({ fraction: null })
      const doc = await loadPdf(file)
      const form = doc.getForm()
      const fields = form.getFields().length
      if (fields) form.flatten()
      throwIfAborted(ctx.signal)
      const output = await deliver(ctx, { input: file, ext: 'pdf', category: 'document', suffix: PDF_TEXT.suffix.flattened }, async (tmp) => {
        if (!gs) return savePdf(doc, tmp)
        const step = path.join(ctx.tempDir, `flatten-${randomUUID()}.pdf`)
        try {
          await savePdf(doc, step)
          await runGhostscript(gs, flattenArgs(step, tmp), { signal: ctx.signal, tempDir: ctx.tempDir, intent: 'flatten' })
        } finally {
          await fs.rm(step, { force: true }).catch(() => undefined)
        }
      })
      return { outputs: [output], warnings: !fields && !gs ? [PDF_TEXT.noForm] : [] }
    })
  },
}
