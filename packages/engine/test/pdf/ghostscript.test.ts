// The Ghostscript pdf ops. They run when Ghostscript is found (SPARKY_TEST_BIN, PATH or Program Files\gs); otherwise the refusal is tested.
import type { Job } from '@sparky/core'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { locateTools } from '../../src'
import { BIN, makePdf, pdfOf, rig, type Rig } from './helpers'

const GS = locateTools(BIN ? [BIN] : []).ghostscript

describe.skipIf(GS)('pdf ops without Ghostscript', () => {
  let r: Rig
  beforeAll(async () => {
    r = await rig()
  })
  afterAll(() => r?.close())

  it('refuses compress, protect and unlock up front, and still flattens', async () => {
    const file = await makePdf(path.join(r.dir, 'a.pdf'), 1)
    for (const op of ['pdf.compress', 'pdf.protect', 'pdf.unlock']) {
      await expect(r.engine.runOp(op, { files: [file], userPassword: 'x' })).rejects.toMatchObject({ code: 'unavailable', message: expect.stringMatching(/needs Ghostscript/) })
    }
    const job = await r.run('pdf.flatten', { files: [file] })
    expect(job.status).toBe('done')
    expect(job.note).toMatch(/no form fields/)
  })
})

describe.skipIf(!GS)('pdf ops with Ghostscript', () => {
  let r: Rig
  let file: string
  const ok = (job: Job) => {
    expect(job.error).toBeUndefined()
    expect(job.status).toBe('done')
    for (const o of job.outputs) expect(fs.existsSync(o), o).toBe(true)
    return job.outputs
  }

  beforeAll(async () => {
    r = await rig()
    file = await makePdf(path.join(r.dir, 'doc.pdf'), 4)
  })
  afterAll(() => r?.close())

  it('pdf.compress: a smaller copy, or the original with a note', async () => {
    const job = await r.run('pdf.compress', { files: [file], compression: 4 })
    const [out] = ok(job)
    if (out === file) expect(job.note).toMatch(/Already as small/)
    else {
      expect(path.basename(out!)).toBe('doc (smaller).pdf')
      expect(job.sizeAfter).toBeLessThan(job.sizeBefore!)
    }
    expect(await (await pdfOf(out!)).getPageCount()).toBe(4)
    const named = path.join(r.dir, 'named.pdf')
    ok(await r.run('pdf.compress', { files: [file], out: named }))
    expect(fs.existsSync(named)).toBe(true)
  })

  it('pdf.protect then pdf.unlock round-trips, and a wrong password says so', async () => {
    expect((await r.run('pdf.protect', { files: [file] })).error).toMatch(/Give a password/)
    const [locked] = ok(await r.run('pdf.protect', { files: [file], userPassword: 'open sesame', allowCopy: false }))
    expect(path.basename(locked!)).toBe('doc (protected).pdf')
    await expect(PDFDocument.load(fs.readFileSync(locked!))).rejects.toThrow(/encrypted/i)

    const wrong = await r.run('pdf.unlock', { files: [locked], password: 'nope' })
    expect(wrong.status).toBe('failed')
    expect(wrong.error).toMatch(/That password doesn’t open this PDF/)
    expect(wrong.error).not.toContain('nope')

    const [open] = ok(await r.run('pdf.unlock', { files: [locked], password: 'open sesame' }))
    expect((await pdfOf(open!)).getPageCount()).toBe(4)
  })

  it('pdf.protect with a non-ASCII password opens in pdf.js with that password, limits printing, and unlocks', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const open = async (file: string, password: string) => {
      const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), password, verbosity: 0 })
      try {
        const doc = await task.promise
        return { pages: doc.numPages, permissions: await doc.getPermissions() }
      } catch (e) {
        return { error: (e as Error).name }
      } finally {
        await task.destroy()
      }
    }
    const [locked] = ok(await r.run('pdf.protect', { files: [file], userPassword: 'café' }))
    expect(await open(locked!, 'café')).toMatchObject({ pages: 4 })
    expect(await open(locked!, 'cafe')).toEqual({ error: 'PasswordException' })

    const [noPrint] = ok(await r.run('pdf.protect', { files: [file], userPassword: 'café', allowPrint: false, out: path.join(r.dir, 'no print.pdf') }))
    const opened = await open(noPrint!, 'café')
    expect(opened).toMatchObject({ pages: 4 })
    expect(opened.permissions).not.toContain(pdfjs.PermissionFlag.PRINT)
    expect(opened.permissions).toContain(pdfjs.PermissionFlag.COPY)

    expect((await r.run('pdf.unlock', { files: [locked], password: 'cafe' })).error).toMatch(/That password doesn’t open this PDF/)
    const [unlocked] = ok(await r.run('pdf.unlock', { files: [locked], password: 'café' }))
    expect((await pdfOf(unlocked!)).getPageCount()).toBe(4)
  })

  it('writes into a folder whose name has a %', async () => {
    const out = path.join(r.dir, '100% done', 'small.pdf')
    ok(await r.run('pdf.compress', { files: [file], out }))
    expect(await (await pdfOf(out)).getPageCount()).toBe(4)
  })

  it('pdf.flatten: draws form fields into the page through Ghostscript', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([300, 200])
    const field = doc.getForm().createTextField('name')
    field.setText('Harry')
    field.addToPage(page, { x: 20, y: 100, width: 200, height: 30 })
    const form = path.join(r.dir, 'form.pdf')
    fs.writeFileSync(form, await doc.save())
    const [out] = ok(await r.run('pdf.flatten', { files: [form] }))
    expect((await pdfOf(out!)).getForm().getFields()).toHaveLength(0)
  })
})
