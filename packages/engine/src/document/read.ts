// Readers: turn a document's bytes into rows or text.
import Papa from 'papaparse'
import type { DocumentOptions } from '@sparky/core'
import { throwIfAborted } from '../process'

export type Cell = string | number | boolean | null
export type Rows = Cell[][]

const decoder = new TextDecoder()

export function decodeText(data: Uint8Array): string {
  return decoder.decode(data)
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/

// Zip codes, phone numbers and padded values are identifiers, not numbers: typing them loses characters.
function typeCell(value: string): Cell {
  if (value === '') return null
  if (/^-?0\d/.test(value) || value.startsWith('+') || value !== value.trim()) return value
  if (/^true$/i.test(value)) return true
  if (/^false$/i.test(value)) return false
  if (NUMBER.test(value)) {
    const n = Number(value)
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n
  }
  return value
}

export function readCsv(data: Uint8Array, o: DocumentOptions = {}): Rows {
  const result = Papa.parse<string[]>(decodeText(data), {
    delimiter: o.delimiter ?? '',
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  })
  if (result.errors.length && result.data.length === 0) {
    throw new Error(result.errors[0]?.message ?? 'This CSV file could not be read.')
  }
  return result.data.map((row) => row.map(typeCell))
}

export async function readWorkbook(data: Uint8Array, o: DocumentOptions = {}): Promise<Rows> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(data as unknown as ArrayBuffer)
  } catch {
    throw new Error('This workbook could not be opened. It may be damaged, or not really an .xlsx file.')
  }
  const sheet = typeof o.sheet === 'string' ? wb.getWorksheet(o.sheet) : wb.worksheets[typeof o.sheet === 'number' ? o.sheet : 0]
  if (!sheet) throw new Error('That sheet is not in this workbook.')

  const rows: Rows = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // exceljs pads index 0 so column A lands at [1].
    rows.push((row.values as unknown[]).slice(1).map(toCell))
  })
  return rows
}

export function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  // Formula, hyperlink and rich-text cells arrive as objects; only the rendered value fits a row.
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }> }
    if (v.result !== undefined) return toCell(v.result)
    if (typeof v.text === 'string') return v.text
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('')
  }
  return String(value)
}

export function parseJson(data: Uint8Array): unknown {
  try {
    return JSON.parse(decodeText(data))
  } catch (err) {
    throw new Error(`This file is not valid JSON: ${(err as Error).message}`)
  }
}

export function readJsonRows(data: Uint8Array): Rows {
  const parsed = parseJson(data)
  if (!Array.isArray(parsed)) {
    throw new Error('Only a JSON array of objects can become a table. This file holds a single object or value.')
  }
  if (parsed.length === 0) return []
  const objects = parsed.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Record<string, unknown>[]
  if (objects.length !== parsed.length) {
    throw new Error('Every item in the array has to be an object for this to become a table.')
  }
  const columns: string[] = []
  for (const row of objects) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key)
  }
  return [columns, ...objects.map((row) => columns.map((c) => toCell(row[c])))]
}

export const SCANNED_PDF_MESSAGE = 'This PDF has no selectable text. It is probably a scan, which needs text recognition (OCR) rather than conversion.'

/** Text of every page. Progress runs 0 to 100 across the pages. */
export async function readPdfText(data: Uint8Array, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdf.js detaches the buffer it is given, so hand it a copy the caller will not reuse.
  const task = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true, verbosity: 0 })
  const doc = await task.promise.catch(() => {
    throw new Error('This PDF could not be opened. It may be damaged or password protected.')
  })
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      throwIfAborted(signal)
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      let text = ''
      let lastY: number | undefined
      for (const item of content.items) {
        if (!('str' in item)) continue
        const y = item.transform[5] as number
        if (lastY !== undefined && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n'
        text += item.str
        if (item.hasEOL) text += '\n'
        lastY = y
      }
      pages.push(text.replace(/\n{3,}/g, '\n\n').trim())
      onProgress?.((i / doc.numPages) * 100)
    }
    const joined = pages.filter(Boolean).join('\n\n')
    if (!joined.trim()) throw new Error(SCANNED_PDF_MESSAGE)
    return joined
  } finally {
    await task.destroy()
  }
}
