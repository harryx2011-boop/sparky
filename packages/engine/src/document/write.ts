// Writers: turn rows or text into a document's bytes.
import Papa from 'papaparse'
import { XMLBuilder } from 'fast-xml-parser'
import type { DocumentOptions } from '@sparky/core'
import type { Cell, Rows } from './read'

export function writeCsv(rows: Rows, o: DocumentOptions = {}): string {
  return Papa.unparse(rows as unknown[][], { delimiter: o.delimiter ?? ',' })
}

export async function writeWorkbook(rows: Rows): Promise<Uint8Array> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Sheet1')
  for (const row of rows) sheet.addRow(row)
  if (rows.length > 1) sheet.getRow(1).font = { bold: true }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

function headerKeys(header: Cell[] | undefined, rename: (key: string) => string = (k) => k): string[] {
  const used = new Set<string>()
  return (header ?? []).map((h, i) => {
    const base = rename(h === null || h === '' ? `column_${i + 1}` : String(h))
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`
    used.add(key)
    return key
  })
}

export function writeJsonFromRows(rows: Rows, o: DocumentOptions = {}): string {
  const [header, ...body] = rows
  if (!header) return '[]'
  const keys = headerKeys(header)
  const objects = body.map((row) => Object.fromEntries(keys.map((k, i) => [k, row[i] ?? null])))
  return JSON.stringify(objects, null, o.indent ?? 2)
}

function xmlName(key: string): string {
  const cleaned = key.replace(/[^\w.-]/g, '_')
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

export function writeXmlFromRows(rows: Rows): string {
  const [header, ...body] = rows
  const keys = headerKeys(header, xmlName)
  const items = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
  return new XMLBuilder({ format: true, indentBy: '  ' }).build({ rows: { row: items } }) as string
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function rowsToHtml(rows: Rows, o: DocumentOptions = {}): string {
  const [header, ...body] = rows
  const cell = (c: Cell) => escapeHtml(c === null ? '' : String(c))
  const withHeader = o.header ?? true
  const head = withHeader && header ? `<thead><tr>${header.map((c) => `<th>${cell(c)}</th>`).join('')}</tr></thead>` : ''
  const rest = withHeader ? body : rows
  const tbody = `<tbody>${rest.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
  return `<table>${head}${tbody}</table>`
}

export function rowsToMarkdown(rows: Rows): string {
  if (rows.length === 0) return ''
  const cell = (c: Cell) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const [header, ...body] = rows
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r: Cell[]) => Array.from({ length: width }, (_, i) => cell(r[i] ?? ''))
  return [
    `| ${pad(header ?? []).join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map((r) => `| ${pad(r).join(' | ')} |`),
  ].join('\n')
}

export function rowsToText(rows: Rows, o: DocumentOptions = {}): string {
  const sep = o.delimiter && o.delimiter !== ',' ? o.delimiter : '\t'
  return rows.map((r) => r.map((c) => (c === null ? '' : String(c))).join(sep)).join('\n')
}

export function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

export function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 15px/1.6 system-ui, -apple-system, sans-serif; margin: 2rem auto; max-width: 46rem; padding: 0 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d4d4dc; padding: 6px 10px; text-align: left; }
  th { background: #f4f4f7; }
</style>
${body}
</html>`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import('turndown')).default
  return new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(html)
}

export async function markdownToHtml(md: string): Promise<string> {
  const { marked } = await import('marked')
  return marked.parse(md, { async: true })
}

const PAGE_SIZES: Record<NonNullable<DocumentOptions['pageSize']>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
}

/**
 * Text to PDF, laid out by hand: pdf-lib draws strings at coordinates and has no text flow,
 * so wrapping, pagination and the baseline walk happen here. Standard Helvetica only.
 */
export async function writePdf(text: string, o: DocumentOptions = {}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const size = 10
  const leading = size * 1.45
  const margin = 54
  const base = PAGE_SIZES[o.pageSize ?? 'a4']
  const [pw, ph] = o.orientation === 'landscape' ? [base[1], base[0]] : base
  const maxWidth = pw - margin * 2

  // pdf-lib throws on the first character WinAnsi cannot encode; swap those so one emoji cannot fail the file.
  const encodable = new Set(font.getCharacterSet())
  const safe = (s: string) => Array.from(s, (ch) => (encodable.has(ch.codePointAt(0)!) ? ch : '?')).join('')
  const width = (s: string) => font.widthOfTextAtSize(s, size)
  const estimate = Math.max(1, Math.floor(maxWidth / width('x')))

  // Longest prefix that fits one line, found by search so a huge token never measures itself whole.
  const fitPrefix = (s: string): number => {
    let hi = Math.min(s.length, estimate * 2)
    while (hi < s.length && width(s.slice(0, hi)) <= maxWidth) hi = Math.min(s.length, hi * 2)
    let lo = 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (width(s.slice(0, mid)) <= maxWidth) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    let current = ''
    for (const raw of paragraph.split(/\s+/)) {
      const word = safe(raw)
      const candidate = current ? `${current} ${word}` : word
      if (width(candidate) <= maxWidth) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      let rest = word
      while (rest.length > 1) {
        const cut = fitPrefix(rest)
        if (cut >= rest.length) break
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      current = rest
    }
    lines.push(current)
  }

  let page = doc.addPage([pw, ph])
  let y = ph - margin
  for (const line of lines) {
    if (y < margin) {
      page = doc.addPage([pw, ph])
      y = ph - margin
    }
    if (line) page.drawText(line, { x: margin, y, size, font, color: rgb(0.07, 0.07, 0.08) })
    y -= leading
  }
  return doc.save()
}
