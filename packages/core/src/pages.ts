// Page lists such as "1-3, 5, 8-" or "odd", read against a document's page count. Pages are 1-based.
import { PDF_TEXT } from './ops-text/pdf'

function expand(part: string, total: number): number[] {
  const p = part.trim().toLowerCase()
  if (p === 'all') return Array.from({ length: total }, (_, i) => i + 1)
  if (p === 'odd' || p === 'even') return Array.from({ length: total }, (_, i) => i + 1).filter((n) => (n % 2 === 1) === (p === 'odd'))
  const m = /^(\d+|last)?\s*(-)?\s*(\d+|last)?$/.exec(p)
  if (!m || (!m[1] && !m[3]) || (!m[2] && m[3])) throw new Error(PDF_TEXT.badPages(part.trim()))
  const num = (s: string | undefined, fallback: number) => (s === undefined ? fallback : s === 'last' ? total : Number(s))
  const start = num(m[1], 1)
  const end = m[2] ? num(m[3], total) : start
  if (start < 1 || end < 1) throw new Error(PDF_TEXT.badPages(part.trim()))
  if (start > total) throw new Error(PDF_TEXT.pageOutOfRange(start, total))
  const stop = Math.min(end, total)
  if (stop >= start) return Array.from({ length: stop - start + 1 }, (_, i) => start + i)
  return Array.from({ length: start - stop + 1 }, (_, i) => start - i)
}

export function parsePageGroups(spec: string, total: number): number[][] {
  const parts = spec.split(/[,;]/).filter((s) => s.trim() !== '')
  if (parts.length === 0) return total > 0 ? [Array.from({ length: total }, (_, i) => i + 1)] : []
  const groups = parts.map((part) => expand(part, total)).filter((g) => g.length > 0)
  if (groups.length === 0) throw new Error(PDF_TEXT.noPagesMatch(spec.trim()))
  return groups
}

export function parsePageRanges(spec: string, total: number): number[] {
  return [...new Set(parsePageGroups(spec, total).flat())]
}

export function isSinglePage(spec: string | undefined): boolean {
  return spec !== undefined && /^\s*\d+\s*$/.test(spec)
}
