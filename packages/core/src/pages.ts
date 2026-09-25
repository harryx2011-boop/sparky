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
  // An open or overlong end stops at the last page; a range written backwards runs backwards.
  const stop = Math.min(end, total)
  if (stop >= start) return Array.from({ length: stop - start + 1 }, (_, i) => start + i)
  return Array.from({ length: start - stop + 1 }, (_, i) => start - i)
}

/**
 * Each comma-separated part as its own group, in the order written: "1-3,4-6" gives [[1,2,3],[4,5,6]].
 * Parts are page numbers, ranges ("2-4", "8-", "-3", "5-last", "4-2" runs backwards) or the words all, odd and even.
 * An empty spec is every page. Throws a plain-language Error for anything else.
 */
export function parsePageGroups(spec: string, total: number): number[][] {
  const parts = spec.split(/[,;]/).filter((s) => s.trim() !== '')
  if (parts.length === 0) return total > 0 ? [Array.from({ length: total }, (_, i) => i + 1)] : []
  const groups = parts.map((part) => expand(part, total)).filter((g) => g.length > 0)
  if (groups.length === 0) throw new Error(PDF_TEXT.noPagesMatch(spec.trim()))
  return groups
}

/** Every page the spec names, once each, in the order first written. */
export function parsePageRanges(spec: string, total: number): number[] {
  return [...new Set(parsePageGroups(spec, total).flat())]
}

/** True when the spec names exactly one page, so a job over it makes one file. */
export function isSinglePage(spec: string | undefined): boolean {
  return spec !== undefined && /^\s*\d+\s*$/.test(spec)
}
