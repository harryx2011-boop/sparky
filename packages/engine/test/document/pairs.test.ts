import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DOC_TARGETS, type DocFormat } from '@sparky/core'
import { convertDocument } from '../../src/document'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'document')

let work: string
const sources = new Map<DocFormat, string>()

beforeAll(async () => {
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'sparky-doc-pairs-'))
  for (const ext of ['csv', 'json', 'md', 'html', 'txt', 'xml'] as const) sources.set(ext, path.join(FIXTURES, `sample.${ext}`))
  const xlsx = path.join(work, 'sample.xlsx')
  await convertDocument(path.join(FIXTURES, 'sample.csv'), xlsx, 'xlsx')
  sources.set('xlsx', xlsx)
  const pdf = path.join(work, 'sample.pdf')
  await convertDocument(path.join(FIXTURES, 'sample.txt'), pdf, 'pdf')
  sources.set('pdf', pdf)
})

afterAll(async () => {
  await fs.rm(work, { recursive: true, force: true })
})

const pairs = (Object.entries(DOC_TARGETS) as [DocFormat, readonly DocFormat[]][]).flatMap(([from, targets]) =>
  targets.map((to) => [from, to] as const),
)

describe('every document pair converts end to end', () => {
  it('covers every source format', () => {
    expect(new Set(pairs.map(([from]) => from)).size).toBe(Object.keys(DOC_TARGETS).length)
  })

  it.each(pairs)('%s to %s', async (from, to) => {
    const source = sources.get(from)!
    const output = path.join(work, `${from}-to-${to}.${to}`)
    const seen: number[] = []
    await convertDocument(source, output, to, {}, (pct) => seen.push(pct))
    const stat = await fs.stat(output)
    expect(stat.size).toBeGreaterThan(0)
    expect(seen.at(-1)).toBe(100)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]!)
  })
})

describe('pair output content', () => {
  const read = (name: string) => fs.readFile(path.join(work, name), 'utf8')

  it('keeps every row and the quoted comma from csv to json', async () => {
    const rows = JSON.parse(await read('csv-to-json.json')) as Record<string, unknown>[]
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual({ name: 'Linus', city: 'Helsinki, FI', score: 88 })
  })

  it('writes table rows as xml elements', async () => {
    const xml = await read('csv-to-xml.xml')
    expect(xml).toContain('<rows>')
    expect(xml).toContain('<name>Grace</name>')
    expect(await read('xlsx-to-xml.xml')).toContain('<city>London</city>')
  })

  it('unions json keys into columns', async () => {
    const csv = await read('json-to-csv.csv')
    expect(csv.split(/\r?\n/)[0]).toBe('name,city,score,active')
  })

  it('parses xml attributes into json', async () => {
    const json = JSON.parse(await read('xml-to-json.json')) as { library: { book: Array<Record<string, unknown>> } }
    expect(json.library.book[0]).toMatchObject({ '@id': '1', title: 'Dune', year: 1965 })
  })

  it('renders markdown to html and html to markdown', async () => {
    expect(await read('md-to-html.html')).toContain('<strong>documents</strong>')
    const md = await read('html-to-md.md')
    expect(md).toContain('# Quarterly summary')
    expect(md).toContain('Revenue grew & costs fell.')
  })

  it('reads text back out of a generated pdf', async () => {
    const txt = await read('pdf-to-txt.txt')
    expect(txt).toContain('Plain text notes.')
    expect(txt).toContain('A second paragraph.')
  })
})

describe('refusals', () => {
  it('refuses a pair outside the matrix', async () => {
    await expect(convertDocument(sources.get('pdf')!, path.join(work, 'x.xlsx'), 'xlsx')).rejects.toThrow('PDF cannot be converted to XLSX')
  })

  it('refuses a file it does not read', async () => {
    const xls = path.join(work, 'old.xls')
    await fs.writeFile(xls, 'not really')
    await expect(convertDocument(xls, path.join(work, 'old.csv'), 'csv')).rejects.toThrow('is not a document this converter reads')
  })
})
