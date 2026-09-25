// pdf.split: one PDF into several, in a folder named after it.
import { parsePageGroups, PDF_TEXT } from '@sparky/core'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod/v4'
import { throwIfAborted } from '../../process'
import type { Op } from '../../ops/types'
import { baseName, deliver } from '../deliver'
import { loadPdf, savePdf } from '../document'
import { eachFile, pdfFilesField, pdfOp } from './common'

const input = z.object({
  files: pdfFilesField,
  /** 'ranges': one file per part of `ranges`; 'every': `every` pages per file; 'pages': one file per page; 'odd_even': odd pages and even pages. Defaults to 'ranges' when `ranges` is given, else 'pages'. */
  mode: z.enum(['ranges', 'every', 'pages', 'odd_even']).optional().meta(PDF_TEXT.fields.splitMode),
  /** Parts separated by commas, e.g. "1-3,4-6". */
  ranges: z.string().optional().meta(PDF_TEXT.fields.ranges),
  /** Pages per file in 'every' mode; 1 when left out. */
  every: z.number().int().min(1).optional().meta(PDF_TEXT.fields.every),
})

type Args = z.infer<typeof input>

interface Part {
  pages: number[]
  suffix: string
}

/** The files a split makes, as 1-based page lists with their name suffixes. */
export function splitParts(a: Pick<Args, 'mode' | 'ranges' | 'every'>, total: number): Part[] {
  const all = Array.from({ length: total }, (_, i) => i + 1)
  const mode = a.mode ?? (a.ranges ? 'ranges' : 'pages')
  let groups: number[][]
  switch (mode) {
    case 'odd_even':
      return [
        { pages: all.filter((p) => p % 2 === 1), suffix: PDF_TEXT.oddSuffix },
        { pages: all.filter((p) => p % 2 === 0), suffix: PDF_TEXT.evenSuffix },
      ].filter((p) => p.pages.length > 0)
    case 'ranges':
      if (!a.ranges?.trim()) throw new Error(PDF_TEXT.rangesMissing)
      groups = parsePageGroups(a.ranges, total)
      break
    case 'every': {
      const n = a.every ?? 1
      groups = []
      for (let i = 0; i < total; i += n) groups.push(all.slice(i, i + n))
      break
    }
    case 'pages':
      groups = all.map((p) => [p])
      break
  }
  const used = new Set<string>()
  return groups.map((pages, i) => {
    let suffix = PDF_TEXT.partSuffix(pages, i + 1, groups.length)
    // The same pages asked for twice would overwrite each other; the part number is unique.
    if (used.has(suffix)) suffix = PDF_TEXT.partSuffix([], i + 1, groups.length)
    used.add(suffix)
    return { pages, suffix }
  })
}

export const splitOp: Op<typeof input> = {
  ...pdfOp('pdf.split', 'each'),
  input,
  many: () => true,
  run(ctx, a) {
    return eachFile(a.files, async (file) => {
      const doc = await loadPdf(file)
      const parts = splitParts(a, doc.getPageCount())
      const base = baseName(file)
      return deliver(ctx, { input: file, ext: 'folder', category: 'document' }, async (dir) => {
        for (const [i, part] of parts.entries()) {
          throwIfAborted(ctx.signal)
          const out = await PDFDocument.create()
          for (const page of await out.copyPages(doc, part.pages.map((p) => p - 1))) out.addPage(page)
          await savePdf(out, path.join(dir, `${base}${part.suffix}.pdf`))
          ctx.progress({ fraction: (i + 1) / parts.length })
        }
      })
    })
  },
}
