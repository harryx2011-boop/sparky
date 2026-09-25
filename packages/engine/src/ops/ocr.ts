// ocr: the text in a picture, as plain text, a searchable PDF (the picture with an invisible text layer), or both.
import { OCR_TEXT } from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import { CanceledError, throwIfAborted } from '../process'
import { saveResult } from '../image/save'
import { ocrImage, readsForOcr } from '../ocr/image'
import { openReader, type OcrReader } from '../ocr/tesseract'
import type { Op, OpContext } from './types'

const F = OCR_TEXT.ocr.fields

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  output: z.enum(['txt', 'pdf', 'both']).optional().meta(F.output),
  // Letters and underscores only, so a code can never point outside the language folders.
  language: z
    .string()
    .regex(/^[A-Za-z_]+(?:\+[A-Za-z_]+)*$/)
    .optional()
    .meta(F.language),
})

/** The app's data folder; the engine adds it to every op's context. Tests without one keep languages in scratch. */
const dataDirOf = (ctx: OpContext) => ctx.dataDir ?? ctx.tempDir

async function open(ctx: OpContext, language: string): Promise<OcrReader> {
  try {
    return await openReader({ language, bundled: ctx.tools.tessdata, cachePath: path.join(dataDirOf(ctx), 'tessdata') }, ctx.signal)
  } catch (e) {
    if (e instanceof CanceledError) throw e
    throw new Error(OCR_TEXT.language(language))
  }
}

export const ocrOp: Op<typeof input> = {
  id: 'ocr',
  label: OCR_TEXT.ocr.label,
  doneLabel: OCR_TEXT.ocr.done,
  category: 'tool',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: readsForOcr,
  many: (a) => a.output === 'both' || a.files.length > 1,
  describe(a) {
    const file = a.files[0] ?? ''
    return { title: OCR_TEXT.ocr.title(file, a.output ?? 'txt'), source: file, category: 'image' }
  },
  async run(ctx, a) {
    const output = a.output ?? 'txt'
    for (const file of a.files) {
      const stat = await fs.stat(file).catch(() => undefined)
      if (!stat?.isFile()) throw new Error(OCR_TEXT.gone)
      if (!readsForOcr(file)) throw new Error(OCR_TEXT.notAnImage(path.basename(file)))
    }
    ctx.progress({ fraction: 0 })
    const reader = await open(ctx, a.language ?? 'eng')
    const outputs: string[] = []
    const warnings: string[] = []
    try {
      for (const [i, file] of a.files.entries()) {
        throwIfAborted(ctx.signal)
        const image = await ocrImage(file)
        const page = await reader
          .read(image, { pdf: output !== 'txt', title: path.parse(file).name }, (p) => ctx.progress({ fraction: (i + p) / a.files.length }))
          .catch((e) => {
            throw e instanceof CanceledError ? e : new Error(OCR_TEXT.failed)
          })
        throwIfAborted(ctx.signal)
        if (!page.text.trim()) warnings.push(OCR_TEXT.noText)
        if (output !== 'pdf') outputs.push(await saveResult(ctx, { input: file, ext: 'txt', category: 'document' }, (tmp) => fs.writeFile(tmp, page.text, 'utf8')))
        if (output !== 'txt') {
          if (!page.pdf) throw new Error(OCR_TEXT.failed)
          const pdf = page.pdf
          outputs.push(await saveResult(ctx, { input: file, ext: 'pdf', category: 'document' }, (tmp) => fs.writeFile(tmp, pdf)))
        }
      }
    } finally {
      await reader.close().catch(() => undefined)
    }
    return { outputs, warnings: [...new Set(warnings)] }
  },
}

export const ocrOps: readonly Op[] = [ocrOp]
