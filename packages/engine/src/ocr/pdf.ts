// A PDF read page by page: each page drawn to a picture, read by the one worker, and the per-page searchable PDFs joined in order.
import { OCR_TEXT } from '@sparky/core'
import { PDFDocument } from 'pdf-lib'
import { renderPdfPages } from '../pdf/raster'
import { throwIfAborted } from '../process'
import type { OcrPage } from './tesseract'

/** Starts every page after the first in the text, as Tesseract's own text output does. */
export const PAGE_BREAK = '\f'

export interface PdfReadOptions {
  dpi: number
  pdf: boolean
  title: string
}

export interface PdfRead {
  /** Each page's text, in order. */
  pages: string[]
  /** One searchable PDF, when asked for. */
  pdf?: Buffer
}

type ReadPage = (png: Buffer, progress: (fraction: number) => void) => Promise<OcrPage>

export async function ocrPdf(file: string, opts: PdfReadOptions, read: ReadPage, signal: AbortSignal, progress: (fraction: number) => void): Promise<PdfRead> {
  const pages: string[] = []
  const merged = opts.pdf ? await PDFDocument.create() : undefined
  for await (const r of renderPdfPages(file, { dpi: opts.dpi }, signal)) {
    const page = await read(r.png, (p) => progress((r.index + p) / r.count))
    throwIfAborted(signal)
    pages.push(page.text)
    if (merged) {
      const pdf = page.pdf
      if (!pdf) throw new Error(OCR_TEXT.failedPdf)
      const [copied] = await PDFDocument.load(pdf)
        .then((one) => merged.copyPages(one, [0]))
        .catch(() => {
          throw new Error(OCR_TEXT.failedPdf)
        })
      // Tesseract sizes a page from the picture's resolution, which a rendered PNG doesn't carry: give it the source page's size back.
      const { width, height } = copied!.getSize()
      copied!.scale((r.width * 72) / opts.dpi / width, (r.height * 72) / opts.dpi / height)
      merged.addPage(copied!)
    }
    progress((r.index + 1) / r.count)
  }
  if (!merged) return { pages }
  merged.setTitle(opts.title)
  return { pages, pdf: Buffer.from(await merged.save()) }
}
