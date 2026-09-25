import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { convertDocument, readWorkbook, writePdf } from '../../src/document'

let work: string

beforeAll(async () => {
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'sparky-doc-review-'))
})

afterAll(async () => {
  await fs.rm(work, { recursive: true, force: true })
})

async function source(name: string, content: string | Uint8Array): Promise<string> {
  const file = path.join(work, name)
  await fs.writeFile(file, content)
  return file
}

describe('writePdf with a very long token', () => {
  it('writes a 20,000-character word in under a second', async () => {
    const start = performance.now()
    await writePdf('x'.repeat(20_000))
    expect(performance.now() - start).toBeLessThan(1000)
  })
})

describe('cancel', () => {
  it('rejects an already-aborted signal before any output exists', async () => {
    const input = await source('cancel.csv', 'a,b\n1,2\n')
    const output = path.join(work, 'cancel.json')
    const controller = new AbortController()
    controller.abort()
    await expect(convertDocument(input, output, 'json', {}, undefined, controller.signal)).rejects.toMatchObject({ name: 'CanceledError' })
    await expect(fs.access(output)).rejects.toThrow()
  })

  it('stops a PDF read between pages', async () => {
    const pdf = path.join(work, 'long.pdf')
    await fs.writeFile(pdf, await writePdf(Array.from({ length: 400 }, (_, i) => `Line ${i}`).join('\n')))
    const output = path.join(work, 'long.txt')
    const controller = new AbortController()
    const run = convertDocument(pdf, output, 'txt', {}, (pct) => {
      if (pct > 10) controller.abort()
    }, controller.signal)
    await expect(run).rejects.toMatchObject({ name: 'CanceledError' })
    await expect(fs.access(output)).rejects.toThrow()
  })
})

describe('csv cell typing', () => {
  const csv = 'name,zip,phone,padded,count\nAda,00123,+441234,  7 ,42\nLinus,02139,+358,8,-3.5\n'

  it('keeps leading zeros, leading plus and padded values as text in json', async () => {
    const output = path.join(work, 'zips.json')
    await convertDocument(await source('zips.csv', csv), output, 'json')
    expect(JSON.parse(await fs.readFile(output, 'utf8'))).toEqual([
      { name: 'Ada', zip: '00123', phone: '+441234', padded: '  7 ', count: 42 },
      { name: 'Linus', zip: '02139', phone: '+358', padded: 8, count: -3.5 },
    ])
  })

  it('keeps leading zeros as text in xlsx', async () => {
    const output = path.join(work, 'zips.xlsx')
    await convertDocument(await source('zips2.csv', csv), output, 'xlsx')
    const rows = await readWorkbook(new Uint8Array(await fs.readFile(output)))
    expect(rows[1]?.[1]).toBe('00123')
    expect(rows[2]?.[1]).toBe('02139')
    expect(rows[1]?.[4]).toBe(42)
  })
})

describe('duplicate headers', () => {
  it('keeps both columns when two headers share a name', async () => {
    const output = path.join(work, 'dates.json')
    await convertDocument(await source('dates.csv', 'Date,Date,Date_2,Date\n1,2,3,4\n'), output, 'json')
    expect(JSON.parse(await fs.readFile(output, 'utf8'))).toEqual([{ Date: 1, Date_2: 2, Date_2_2: 3, Date_3: 4 }])
  })

  it('keeps both columns in xml', async () => {
    const output = path.join(work, 'dates.xml')
    await convertDocument(await source('dates2.csv', 'Date,Date\n1,2\n'), output, 'xml')
    const xml = await fs.readFile(output, 'utf8')
    expect(xml).toContain('<Date>1</Date>')
    expect(xml).toContain('<Date_2>2</Date_2>')
  })
})

describe('pdf progress', () => {
  it('climbs in page-sized steps with no jump after the last page', async () => {
    const pdf = path.join(work, 'progress.pdf')
    await fs.writeFile(pdf, await writePdf(Array.from({ length: 400 }, (_, i) => `Line ${i}`).join('\n')))
    const seen: number[] = []
    await convertDocument(pdf, path.join(work, 'progress.txt'), 'txt', {}, (pct) => seen.push(pct))
    expect(seen[0]).toBe(4)
    expect(seen.at(-1)).toBe(100)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]!)
      expect(seen[i]! - seen[i - 1]!, seen.join(',')).toBeLessThan(15)
    }
  })
})
