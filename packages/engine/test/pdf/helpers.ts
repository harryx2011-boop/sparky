// Shared setup for the pdf op tests: an engine in a temp folder and PDFs and pictures made on the spot.
import type { Job } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import { expect } from 'vitest'
import { createEngine, type Engine } from '../../src'

export const BIN = process.env.SPARKY_TEST_BIN

// libvips keeps files it has read open in its cache, which stops Windows deleting the temp folder.
sharp.cache(false)

export interface Rig {
  dir: string
  engine: Engine
  run(op: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<Job>
  close(): Promise<void>
}

export async function rig(): Promise<Rig> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-pdf-'))
  const engine = await createEngine({
    binDirs: BIN ? [BIN] : [],
    dataDir: path.join(dir, 'data'),
    tempDir: path.join(dir, 'tmp'),
    defaultRoot: path.join(dir, 'Sparky'),
    appVersion: 'test',
    skipGpu: true,
    host: { trash: async (p) => fs.rmSync(p, { recursive: true, force: true }) },
  })
  return {
    dir,
    engine,
    async run(op, args, signal) {
      const jobs = await engine.runOp(op, args, { signal })
      expect(jobs).toHaveLength(1)
      return jobs[0]!
    },
    async close() {
      await engine.shutdown()
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
    },
  }
}

/** A PDF whose page n is (100 + 10n) by (200 + 10n) points and says "Page n". */
export async function makePdf(file: string, pages: number): Promise<string> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage([100 + 10 * n, 200 + 10 * n])
    page.drawText(`Page ${n}`, { x: 10, y: 20, size: 14, font })
  }
  fs.writeFileSync(file, await doc.save())
  return file
}

export async function makePicture(file: string, width: number, height: number, density = 72): Promise<string> {
  const img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } }).withMetadata({ density })
  await (file.endsWith('.jpg') ? img.jpeg() : img.png()).toFile(file)
  return file
}

export const pageCount = async (file: string) => (await PDFDocument.load(fs.readFileSync(file))).getPageCount()
export const pdfOf = async (file: string) => PDFDocument.load(fs.readFileSync(file))
