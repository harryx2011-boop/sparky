// A real engine in a scratch folder, shared by the image and ocr tests.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { createEngine, type Engine } from '../../src'

export const BIN = process.env.SPARKY_TEST_BIN
if (process.env.CI && !BIN) throw new Error('Set SPARKY_TEST_BIN in CI so the real-tool tests run.')

sharp.cache(false)

export interface Harness {
  dir: string
  engine: Engine
  close(): Promise<void>
}

export async function harness(prefix: string): Promise<Harness> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sparky-${prefix}-`))
  const engine = await createEngine({
    binDirs: BIN ? [BIN] : [],
    dataDir: path.join(dir, 'data'),
    tempDir: path.join(dir, 'tmp'),
    defaultRoot: path.join(dir, 'Sparky'),
    appVersion: 'test',
    skipGpu: true,
    host: {},
  })
  return {
    dir,
    engine,
    async close() {
      await engine.shutdown()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
