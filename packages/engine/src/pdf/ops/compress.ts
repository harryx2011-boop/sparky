// pdf.compress: rewrites the PDF through Ghostscript at a compression level. A result no smaller than the original is dropped.
import { explainFileError, ghostscriptArgs, PDF_TEXT, type CompressionLevel } from '@sparky/core'
import fs from 'node:fs/promises'
import { z } from 'zod/v4'
import { compressionField } from '../../ops/fields'
import type { Op, OpResult } from '../../ops/types'
import { throwIfAborted } from '../../process'
import { runGhostscript } from '../ghostscript'
import { needGhostscript, pdfFilesField, pdfOp } from './common'

const input = z.object({
  files: pdfFilesField,
  /** 0 (lossless) to 4 (tiny); the compression setting when left out. */
  compression: compressionField.optional().meta(PDF_TEXT.fields.compression),
})

export const compressOp: Op<typeof input> = {
  ...pdfOp('pdf.compress', 'each'),
  input,
  requires: ['ghostscript'],
  async run(ctx, a) {
    const gs = needGhostscript(ctx, 'pdf.compress')
    const level: CompressionLevel = a.compression ?? ctx.settings().compression
    const result: Required<Pick<OpResult, 'outputs' | 'warnings'>> & { sizeBefore: number; sizeAfter: number } = { outputs: [], warnings: [], sizeBefore: 0, sizeAfter: 0 }
    for (const file of a.files) {
      const before = (await fs.stat(file).catch((e) => Promise.reject(new Error(explainFileError(e, 'read'))))).size
      ctx.progress({ fraction: null })
      const plan = await ctx.output({ input: file, ext: 'pdf', category: 'document', suffix: PDF_TEXT.suffix.smaller })
      const cleanup = () => fs.rm(plan.tmpPath, { force: true }).catch(() => undefined)
      try {
        await runGhostscript(gs, { args: ghostscriptArgs(file, plan.tmpPath, level), secret: [] }, { signal: ctx.signal, tempDir: ctx.tempDir, intent: 'compress', lowPriority: ctx.settings().performance === 'low' })
        throwIfAborted(ctx.signal)
        let after = (await fs.stat(plan.tmpPath)).size
        if (after >= before) {
          result.warnings.push(PDF_TEXT.alreadySmall)
          // Nothing asked for a particular place: point at the original instead of saving a copy that isn't smaller.
          if (!ctx.out) {
            await cleanup()
            result.outputs.push(file)
            result.sizeBefore += before
            result.sizeAfter += before
            continue
          }
          await fs.copyFile(file, plan.tmpPath)
          after = before
        }
        const finalPath = await plan.claimFinal()
        try {
          await plan.place(finalPath)
        } catch (e) {
          await plan.release()
          throw (e as NodeJS.ErrnoException).code ? new Error(explainFileError(e, 'save')) : e
        }
        result.outputs.push(finalPath)
        result.sizeBefore += before
        result.sizeAfter += after
      } catch (e) {
        await cleanup()
        throw e
      }
    }
    return result
  },
}
