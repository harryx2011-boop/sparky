// ocr: the text in a picture or PDF, as plain text, a searchable PDF (the pages as pictures with an invisible text layer), or both.
import { OCR_TEXT } from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import { CanceledError, throwIfAborted } from '../process'
import { saveResult } from '../image/save'
import { isOcrPdf, ocrImage, readsForOcr } from '../ocr/image'
import { ocrPdf, PAGE_BREAK } from '../ocr/pdf'
import { openReader, type OcrPage, type OcrReader } from '../ocr/tesseract'
import type { Op, OpContext } from './types'

const F = OCR_TEXT.ocr.fields

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  output: z.enum(['txt', 'pdf', 'both']).optional().meta(F.output),
  /** Dots per inch PDF pages are drawn at; 300 when left out. */
  dpi: z.number().min(1).optional().meta(F.dpi),
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
    return { title: OCR_TEXT.ocr.title(file, a.output ?? 'txt'), source: file, category: isOcrPdf(file) ? 'document' : 'image' }
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
        const pdfIn = isOcrPdf(file)
        const failed = pdfIn ? OCR_TEXT.failedPdf : OCR_TEXT.failed
        const title = path.parse(file).name
        const onProgress = (p: number) => ctx.progress({ fraction: (i + p) / a.files.length })
        const read = (image: Buffer, progress: (fraction: number) => void): Promise<OcrPage> =>
          reader.read(image, { pdf: output !== 'txt', title }, progress).catch((e) => {
            throw e instanceof CanceledError ? e : new Error(failed)
          })
        let text: string
        let pdf: Buffer | undefined
        if (pdfIn) {
          const doc = await ocrPdf(file, { dpi: a.dpi ?? 300, pdf: output !== 'txt', title }, read, ctx.signal, onProgress)
          text = doc.pages.join(PAGE_BREAK)
          pdf = doc.pdf
          if (!doc.pages.some((t) => t.trim())) warnings.push(OCR_TEXT.noTextPdf)
        } else {
          const page = await read(await ocrImage(file), onProgress)
          text = page.text
          pdf = page.pdf
          if (!text.trim()) warnings.push(OCR_TEXT.noText)
        }
        throwIfAborted(ctx.signal)
        if (output !== 'pdf') outputs.push(await saveResult(ctx, { input: file, ext: 'txt', category: 'document' }, (tmp) => fs.writeFile(tmp, text, 'utf8')))
        if (output !== 'txt') {
          if (!pdf) throw new Error(failed)
          const bytes = pdf
          const suffix = pdfIn ? OCR_TEXT.ocr.searchableSuffix : undefined
          outputs.push(await saveResult(ctx, { input: file, ext: 'pdf', category: 'document', suffix }, (tmp) => fs.writeFile(tmp, bytes)))
        }
      }
    } finally {
      await reader.close().catch(() => undefined)
    }
    return { outputs, warnings: [...new Set(warnings)] }
  },
}

export const ocrOps: readonly Op[] = [ocrOp]
