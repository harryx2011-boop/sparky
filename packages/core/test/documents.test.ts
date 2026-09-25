import { describe, expect, it } from 'vitest'
import {
  DOC_FORMATS,
  DOC_INPUT_EXTS,
  DOC_MIME,
  DOC_TARGETS,
  ValidationError,
  docFamily,
  docTargetsFor,
  isDocFormat,
  normalizeDocExt,
  validateDocumentOptions,
} from '../src'

describe('document format identity', () => {
  it('recognises every declared format and nothing else', () => {
    for (const f of DOC_FORMATS) expect(isDocFormat(f)).toBe(true)
    expect(isDocFormat('mp4')).toBe(false)
    expect(isDocFormat('docx')).toBe(false)
    expect(isDocFormat('')).toBe(false)
  })

  it('leaves xls to LibreOffice', () => {
    expect(isDocFormat('xls')).toBe(false)
    expect(normalizeDocExt('xls')).toBeNull()
    expect(docTargetsFor('xls')).toEqual([])
    expect(DOC_INPUT_EXTS).not.toContain('xls')
  })

  it('maps aliases and casing onto the canonical extension', () => {
    expect(normalizeDocExt('markdown')).toBe('md')
    expect(normalizeDocExt('.MD')).toBe('md')
    expect(normalizeDocExt('htm')).toBe('html')
    expect(normalizeDocExt('HTML')).toBe('html')
    expect(normalizeDocExt('text')).toBe('txt')
    expect(normalizeDocExt('log')).toBe('txt')
    expect(normalizeDocExt('docx')).toBeNull()
  })

  it('gives every format a mime type', () => {
    for (const f of DOC_FORMATS) expect(DOC_MIME[f]).toMatch(/\//)
  })

  it('sorts formats into the three pipeline families', () => {
    expect(docFamily('csv')).toBe('table')
    expect(docFamily('xlsx')).toBe('table')
    expect(docFamily('json')).toBe('table')
    expect(docFamily('md')).toBe('text')
    expect(docFamily('xml')).toBe('text')
    expect(docFamily('pdf')).toBe('page')
  })
})

describe('the conversion matrix', () => {
  it('never lists a target that is not a real format', () => {
    for (const [from, targets] of Object.entries(DOC_TARGETS)) {
      for (const to of targets) expect(isDocFormat(to), `${from} -> ${to}`).toBe(true)
    }
  })

  it('never offers a format as its own target', () => {
    for (const [from, targets] of Object.entries(DOC_TARGETS)) expect(targets, from).not.toContain(from)
  })

  it('never lists a target twice', () => {
    for (const [from, targets] of Object.entries(DOC_TARGETS)) expect(new Set(targets).size, from).toBe(targets.length)
  })

  it('never offers a PDF as a source for a spreadsheet', () => {
    expect(DOC_TARGETS.pdf).not.toContain('xlsx')
    expect(DOC_TARGETS.pdf).not.toContain('csv')
    expect(DOC_TARGETS.pdf).toEqual(['txt', 'md', 'html'])
  })

  it('resolves targets through the alias table', () => {
    expect(docTargetsFor('markdown')).toEqual(DOC_TARGETS.md)
    expect(docTargetsFor('.HTM')).toEqual(DOC_TARGETS.html)
    expect(docTargetsFor('mp4')).toEqual([])
  })

  it('lets every table format reach every other table format and xml', () => {
    for (const from of ['csv', 'xlsx', 'json'] as const) {
      for (const to of ['csv', 'xlsx', 'json', 'xml'] as const) {
        if (from === to) continue
        expect(DOC_TARGETS[from], `${from} -> ${to}`).toContain(to)
      }
    }
  })
})

describe('validateDocumentOptions', () => {
  it('accepts an empty object and the documented values', () => {
    expect(() => validateDocumentOptions({})).not.toThrow()
    expect(() => validateDocumentOptions({ delimiter: ';', indent: 4, pageSize: 'letter', orientation: 'landscape' })).not.toThrow()
    expect(() => validateDocumentOptions({ sheet: 'Sheet2' })).not.toThrow()
    expect(() => validateDocumentOptions({ sheet: 0 })).not.toThrow()
  })

  it('accepts a high sheet index', () => {
    expect(() => validateDocumentOptions({ sheet: 999 })).not.toThrow()
  })

  it('rejects values outside the closed vocabularies', () => {
    expect(() => validateDocumentOptions({ delimiter: '::' as never })).toThrow(ValidationError)
    expect(() => validateDocumentOptions({ indent: 3 as never })).toThrow(ValidationError)
    expect(() => validateDocumentOptions({ pageSize: 'a3' as never })).toThrow(ValidationError)
    expect(() => validateDocumentOptions({ orientation: 'sideways' as never })).toThrow(ValidationError)
  })

  it('rejects a negative, fractional or non-finite sheet index', () => {
    expect(() => validateDocumentOptions({ sheet: -1 })).toThrow(ValidationError)
    expect(() => validateDocumentOptions({ sheet: 1.5 })).toThrow(ValidationError)
    expect(() => validateDocumentOptions({ sheet: Number.NaN })).toThrow(ValidationError)
  })
})
