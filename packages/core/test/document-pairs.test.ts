import { describe, expect, it } from 'vitest'
import { DOC_TARGETS, docTargetsFor, isDocFormat, type DocFormat } from '../src'

const pairs = (Object.entries(DOC_TARGETS) as [DocFormat, readonly DocFormat[]][]).flatMap(([from, targets]) =>
  targets.map((to) => ({ from, to, slug: `${from}-to-${to}` })),
)
const has = (slug: string) => pairs.some((p) => p.slug === slug)

describe('document pairs', () => {
  it('has one route per target in the matrix', () => {
    expect(pairs).toHaveLength(37)
  })

  it('never produces a pair the document module would refuse', () => {
    for (const p of pairs) expect(docTargetsFor(p.from), p.slug).toContain(p.to)
  })

  it('gives every pair a unique slug', () => {
    expect(new Set(pairs.map((p) => p.slug)).size).toBe(pairs.length)
  })

  it('only pairs real document formats', () => {
    for (const p of pairs) {
      expect(isDocFormat(p.from), p.slug).toBe(true)
      expect(isDocFormat(p.to), p.slug).toBe(true)
    }
  })

  it('includes the everyday pairs and the table to xml pairs', () => {
    for (const slug of ['csv-to-xlsx', 'pdf-to-txt', 'md-to-html', 'csv-to-xml', 'xlsx-to-xml', 'json-to-xml', 'xml-to-json']) {
      expect(has(slug), slug).toBe(true)
    }
  })

  it('never offers a spreadsheet out of a PDF, or anything out of xls', () => {
    expect(has('pdf-to-xlsx')).toBe(false)
    expect(has('pdf-to-csv')).toBe(false)
    expect(pairs.some((p) => (p.from as string) === 'xls' || (p.to as string) === 'xls')).toBe(false)
  })
})
