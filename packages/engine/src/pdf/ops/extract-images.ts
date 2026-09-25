// pdf.extract_images: every picture in the PDF, saved into a folder named after it.
import { PDF_TEXT } from '@sparky/core'
import path from 'node:path'
import { z } from 'zod/v4'
import { throwIfAborted } from '../../process'
import type { Op } from '../../ops/types'
import { baseName, breathe, deliver, writeFile } from '../deliver'
import { loadPdf } from '../document'
import { extractImage, imageStreams } from '../extract-images'
import { eachFile, pdfFilesField, pdfOp } from './common'

const input = z.object({ files: pdfFilesField })

export const extractImagesOp: Op<typeof input> = {
  ...pdfOp('pdf.extract_images', 'each'),
  input,
  many: () => true,
  run(ctx, a) {
    return eachFile(a.files, async (file) => {
      const doc = await loadPdf(file)
      const streams = imageStreams(doc)
      if (streams.length === 0) throw new Error(PDF_TEXT.noImages)
      const base = baseName(file)
      let skipped = 0
      const output = await deliver(ctx, { input: file, ext: 'folder', category: 'image' }, async (dir) => {
        let saved = 0
        for (const [i, stream] of streams.entries()) {
          await breathe()
          throwIfAborted(ctx.signal)
          const img = await extractImage(doc, stream).catch(() => undefined)
          if (img) await writeFile(path.join(dir, `${base}${PDF_TEXT.imageSuffix(++saved, streams.length)}.${img.ext}`), img.data)
          else skipped++
          ctx.progress({ fraction: (i + 1) / streams.length })
        }
        if (saved === 0) throw new Error(PDF_TEXT.unreadableImages)
      })
      return { outputs: [output], warnings: skipped ? [PDF_TEXT.skippedImages(skipped)] : [] }
    })
  },
}
