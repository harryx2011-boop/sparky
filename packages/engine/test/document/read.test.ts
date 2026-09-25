import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { PDFDocument } from 'pdf-lib'
import { SCANNED_PDF_MESSAGE, convertDocument, readCsv, readJsonRows, readPdfText, readWorkbook } from '../../src/document'

const bytes = (s: string) => new TextEncoder().encode(s)

let work: string

beforeAll(async () => {
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'sparky-doc-read-'))
})

afterAll(async () => {
  await fs.rm(work, { recursive: true, force: true })
})

async function workbook(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const people = wb.addWorksheet('People')
  people.addRow(['name', 'joined', 'score', 'double'])
  people.addRow(['Ada', new Date(Date.UTC(2024, 0, 15)), 92, { formula: 'C2*2', result: 184 }])
  people.addRow(['Linus', new Date(Date.UTC(2023, 5, 1)), 88, { formula: 'C3*2', result: 176 }])
  const second = wb.addWorksheet('Totals')
  second.addRow(['total', 180])
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

describe('readWorkbook', () => {
  it('reads the first sheet, with dates and formula results as plain cells', async () => {
    expect(await readWorkbook(await workbook())).toEqual([
      ['name', 'joined', 'score', 'double'],
      ['Ada', '2024-01-15', 92, 184],
      ['Linus', '2023-06-01', 88, 176],
    ])
  })

  it('picks a sheet by index or name', async () => {
    const data = await workbook()
    expect(await readWorkbook(data, { sheet: 1 })).toEqual([['total', 180]])
    expect(await readWorkbook(data, { sheet: 'Totals' })).toEqual([['total', 180]])
  })

  it('says so when the sheet is missing', async () => {
    await expect(readWorkbook(await workbook(), { sheet: 'Nope' })).rejects.toThrow('That sheet is not in this workbook.')
  })

  it('round-trips an xlsx generated with exceljs to csv', async () => {
    const xlsx = path.join(work, 'people.xlsx')
    await fs.writeFile(xlsx, await workbook())
    const csv = path.join(work, 'people.csv')
    await convertDocument(xlsx, csv, 'csv')
    expect((await fs.readFile(csv, 'utf8')).split(/\r?\n/)).toEqual([
      'name,joined,score,double',
      'Ada,2024-01-15,92,184',
      'Linus,2023-06-01,88,176',
    ])
  })

  it('round-trips csv through xlsx and back unchanged', async () => {
    const source = path.join(work, 'plain.csv')
    await fs.writeFile(source, 'a,b\n1,x\n2,"y, z"')
    await convertDocument(source, path.join(work, 'plain.xlsx'), 'xlsx')
    await convertDocument(path.join(work, 'plain.xlsx'), path.join(work, 'back.csv'), 'csv')
    expect(await fs.readFile(path.join(work, 'back.csv'), 'utf8')).toBe('a,b\r\n1,x\r\n2,"y, z"')
  })

  it('explains a file that is not a workbook', async () => {
    await expect(readWorkbook(bytes('not a zip'))).rejects.toThrow('This workbook could not be opened')
  })
})

describe('readCsv', () => {
  it('detects the delimiter and types numbers', () => {
    expect(readCsv(bytes('a;b\n1;2\n'))).toEqual([['a', 'b'], [1, 2]])
  })

  it('honours an explicit delimiter', () => {
    expect(readCsv(bytes('a|b\n1|x\n'), { delimiter: '|' })).toEqual([['a', 'b'], [1, 'x']])
  })
})

describe('readJsonRows', () => {
  it('refuses a single object with a plain-language reason', () => {
    expect(() => readJsonRows(bytes('{"a":1}'))).toThrow('Only a JSON array of objects can become a table.')
  })

  it('refuses an array with non-object items', () => {
    expect(() => readJsonRows(bytes('[{"a":1}, 2]'))).toThrow('Every item in the array has to be an object')
  })

  it('reports invalid json', () => {
    expect(() => readJsonRows(bytes('[{'))).toThrow('This file is not valid JSON')
  })

  it('returns no rows for an empty array', () => {
    expect(readJsonRows(bytes('[]'))).toEqual([])
  })
})

describe('readPdfText', () => {
  it('throws a plain-language error for a PDF with no text layer', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    await expect(readPdfText(await doc.save())).rejects.toThrow(SCANNED_PDF_MESSAGE)
  })

  it('surfaces the scan message through convertDocument', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const scan = path.join(work, 'scan.pdf')
    await fs.writeFile(scan, await doc.save())
    await expect(convertDocument(scan, path.join(work, 'scan.txt'), 'txt')).rejects.toThrow('probably a scan')
  })

  it('explains a file that is not a PDF', async () => {
    await expect(readPdfText(bytes('hello'))).rejects.toThrow('This PDF could not be opened')
  })
})
