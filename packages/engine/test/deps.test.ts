// electron-builder rebuilds native modules from the app's package.json, and anything left external must be installed with the app, so it asks for what the engine uses.
import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

const deps = (rel: string) => (JSON.parse(fs.readFileSync(path.join(__dirname, rel), 'utf8')) as { dependencies: Record<string, string> }).dependencies

it('declares the same ranges in the app and the engine for modules left external', () => {
  const engine = deps('../package.json')
  const app = deps('../../../apps/desktop/package.json')
  for (const name of ['better-sqlite3', 'sharp', 'pdfjs-dist', 'turndown']) expect(app[name], name).toBe(engine[name])
})
