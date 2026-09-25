// What every pdf op shares: its registry fields, its input pieces, and the one-PDF-in, one-PDF-out flow.
import { normalizeExt, opUnavailableError, PDF_TEXT, type PdfOpId } from '@sparky/core'
import path from 'node:path'
import type { PDFDocument } from 'pdf-lib'
import { z } from 'zod/v4'
import type { Op, OpContext } from '../../ops/types'
import { deliver } from '../deliver'
import { loadPdf, savePdf } from '../document'

export const filesField = z.array(z.string().min(1)).min(1)
/** The usual first field: PDFs, each handled on its own. */
export const pdfFilesField = filesField.meta(PDF_TEXT.fields.pdfs)
/** A page list: numbers, ranges such as 1-3 or 8-, and the words all, odd and even. */
export const pagesField = z.string()

export const isPdf = (ext: string) => normalizeExt(ext) === 'pdf'

type Shared = 'id' | 'label' | 'doneLabel' | 'category' | 'kind' | 'arity' | 'positional' | 'paths' | 'resumable' | 'accepts' | 'describe'

/** The registry fields every pdf op has: labels from PDF_TEXT, `files` first and made absolute, a title naming the file. */
export function pdfOp(id: PdfOpId, arity: Op['arity'], accepts: (ext: string) => boolean = isPdf): Pick<Op, Shared> {
  const { label, done } = PDF_TEXT.ops[id]
  return {
    id,
    label,
    doneLabel: done,
    category: 'pdf',
    kind: 'tool',
    arity,
    positional: ['files'],
    paths: ['files'],
    resumable: false,
    accepts,
    describe: (a) => {
      const files = (a as { files?: string[] }).files ?? []
      return { title: PDF_TEXT.title(label, path.basename(files[0] ?? ''), files.length) }
    },
  }
}

/** Opens `file`, lets `edit` change it (or build a new document from it), and saves the result under the source's name plus `suffix`. */
export async function editPdf(ctx: OpContext, file: string, suffix: string, edit: (doc: PDFDocument) => Promise<PDFDocument | void>): Promise<string> {
  const doc = await loadPdf(file)
  const result = (await edit(doc)) ?? doc
  return deliver(ctx, { input: file, ext: 'pdf', category: 'document', suffix }, (tmp) => savePdf(result, tmp))
}

/** Runs `each` over the op's files in turn, collecting outputs and warnings. */
export async function eachFile(files: string[], each: (file: string) => Promise<string | { outputs: string[]; warnings?: string[] }>) {
  const outputs: string[] = []
  const warnings: string[] = []
  for (const file of files) {
    const r = await each(file)
    if (typeof r === 'string') outputs.push(r)
    else {
      outputs.push(...r.outputs)
      warnings.push(...(r.warnings ?? []))
    }
  }
  return { outputs, warnings }
}

/** The Ghostscript path, or the plain-language reason the op can't run without it. */
export function needGhostscript(ctx: OpContext, id: PdfOpId): string {
  const gs = ctx.tools.ghostscript
  if (!gs) throw new Error(opUnavailableError(PDF_TEXT.ops[id].label, ['ghostscript']))
  return gs
}
