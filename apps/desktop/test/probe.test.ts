// Dropping a folder means "all the files in it", no tools needed for documents.
import { defaultSettings } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { probeFiles, type EngineEnv } from '../src/main/engine/convert'

const dirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-probe-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const env: EngineEnv = {
  tools: {},
  gpu: { encoders: [] },
  cores: 4,
  settings: () => defaultSettings('/root'),
  host: { trash: async () => undefined, printToPdf: async () => undefined },
  tempDir: os.tmpdir(),
}

describe('probeFiles', () => {
  it('expands a dropped folder into the files inside it', async () => {
    const dir = tmp()
    const folder = path.join(dir, 'Holiday notes')
    fs.mkdirSync(path.join(folder, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(folder, 'day one.md'), '# One')
    fs.writeFileSync(path.join(folder, 'day two.txt'), 'Two')
    fs.writeFileSync(path.join(folder, '.hidden.md'), 'no')
    fs.writeFileSync(path.join(folder, 'nested', 'deep.md'), 'deep')
    const results = await probeFiles(env, [folder, path.join(dir, 'missing.md')])
    expect(results.map((r) => r.name).sort()).toEqual(['day one.md', 'day two.txt', 'missing.md'])
    expect(results.find((r) => r.name === 'day one.md')).toMatchObject({ category: 'document', ext: 'md', size: 5 })
  })

  it('keeps an empty folder as one unconvertible row so the person sees why nothing was added', async () => {
    const dir = tmp()
    const empty = path.join(dir, 'Empty')
    fs.mkdirSync(empty)
    const results = await probeFiles(env, [empty])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ ext: 'folder', category: undefined })
  })
})
