// Converts one document file to another through rows, rich text, or page text.
import fs from 'node:fs/promises'
import path from 'node:path'
import { DOC_TARGETS, docFamily, normalizeDocExt, type DocFormat, type DocumentOptions } from '@sparky/core'
import { throwIfAborted } from '../process'
import { decodeText, readCsv, readJsonRows, readPdfText, readWorkbook, type Rows } from './read'
import {
  htmlDocument,
  htmlToMarkdown,
  markdownToHtml,
  paragraphsToHtml,
  rowsToHtml,
  rowsToMarkdown,
  rowsToText,
  stripHtml,
  writeCsv,
  writeJsonFromRows,
  writePdf,
  writeWorkbook,
  writeXmlFromRows,
  escapeHtml,
} from './write'

type Output = string | Uint8Array

const label = (f: DocFormat) => f.toUpperCase()

async function sourceRows(from: DocFormat, data: Uint8Array, o: DocumentOptions): Promise<Rows> {
  if (from === 'csv') return readCsv(data, o)
  if (from === 'xlsx') return readWorkbook(data, o)
  return readJsonRows(data)
}

async function fromRows(rows: Rows, to: DocFormat, title: string, o: DocumentOptions): Promise<Output> {
  switch (to) {
    case 'csv': return writeCsv(rows, o)
    case 'xlsx': return writeWorkbook(rows)
    case 'json': return writeJsonFromRows(rows, o)
    case 'xml': return writeXmlFromRows(rows)
    case 'html': return htmlDocument(title, rowsToHtml(rows, o))
    case 'md': return rowsToMarkdown(rows)
    case 'txt': return rowsToText(rows, o)
    case 'pdf': return writePdf(rowsToText(rows, o), o)
    default: throw new Error(`A table cannot be converted to ${label(to)}.`)
  }
}

async function fromText(from: DocFormat, text: string, to: DocFormat, title: string, o: DocumentOptions): Promise<Output> {
  if (from === 'xml') {
    if (to === 'json') {
      const { XMLParser } = await import('fast-xml-parser')
      return JSON.stringify(new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' }).parse(text), null, o.indent ?? 2)
    }
    if (to === 'txt') return stripHtml(text)
    if (to === 'html') return htmlDocument(title, `<pre>${escapeHtml(text)}</pre>`)
    if (to === 'pdf') return writePdf(stripHtml(text), o)
  } else if (from === 'md') {
    const html = await markdownToHtml(text)
    if (to === 'html') return htmlDocument(title, html)
    if (to === 'txt') return stripHtml(html)
    if (to === 'pdf') return writePdf(stripHtml(html), o)
  } else if (from === 'html') {
    if (to === 'md') return htmlToMarkdown(text)
    if (to === 'txt') return stripHtml(text)
    if (to === 'pdf') return writePdf(stripHtml(text), o)
  } else if (from === 'txt') {
    if (to === 'md') return text
    if (to === 'html') return htmlDocument(title, paragraphsToHtml(text))
    if (to === 'pdf') return writePdf(text, o)
  }
  throw new Error(`${label(from)} cannot be converted to ${label(to)}.`)
}

function fromPdfText(text: string, to: DocFormat, title: string): Output {
  if (to === 'txt' || to === 'md') return text
  if (to === 'html') return htmlDocument(title, paragraphsToHtml(text))
  throw new Error(`A PDF can only become text, Markdown or HTML, not ${label(to)}.`)
}

/** Converts the document at `input` to `to` and writes it to `output`. Progress runs 0 to 100. */
export async function convertDocument(
  input: string,
  output: string,
  to: DocFormat,
  options: DocumentOptions = {},
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const report = (pct: number) => onProgress?.(Math.max(0, Math.min(100, Math.round(pct))))
  const from = normalizeDocExt(path.extname(input))
  if (!from) throw new Error(`${path.basename(input)} is not a document this converter reads.`)
  if (!DOC_TARGETS[from].includes(to)) throw new Error(`${label(from)} cannot be converted to ${label(to)}.`)

  throwIfAborted(signal)
  report(4)
  const data = new Uint8Array(await fs.readFile(input))
  const title = path.parse(input).name
  let result: Output

  const family = docFamily(from)
  if (family === 'table') {
    const rows = await sourceRows(from, data, options)
    throwIfAborted(signal)
    report(55)
    result = await fromRows(rows, to, title, options)
  } else if (family === 'page') {
    const text = await readPdfText(data, (pct) => report(4 + pct * 0.84), signal)
    result = fromPdfText(text, to, title)
  } else {
    report(40)
    result = await fromText(from, decodeText(data), to, title, options)
  }

  throwIfAborted(signal)
  await fs.writeFile(output, result)
  report(100)
}
