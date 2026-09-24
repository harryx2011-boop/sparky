// Edge cases with the real tools: odd names, bad folders, broken files and mixed batches.
// Needs SPARKY_TEST_BIN like engine.test.ts; skipped without it.
import type { ConvertSettings, Job } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEngine, type Engine } from '../src/main/engine'
import { run } from '../src/main/engine/process'

const BIN = process.env.SPARKY_TEST_BIN
const has = (name: string) => Boolean(BIN && [name, `${name}.exe`].some((f) => fs.existsSync(path.join(BIN, f))))
const RAW_TOOL_TEXT = /ENOENT|EACCES|EPERM|ENOTDIR|Invalid data found|Compressed: 0|Can't open as archive|moov atom/i

const base: ConvertSettings = { output: 'mp4', compression: 2, resolution: null, performance: 'normal', originals: 'keep', advanced: {} }

describe.skipIf(!BIN)('engine edge cases', () => {
  let dir: string
  let engine: Engine

  const waitFor = (id: string) =>
    new Promise<Job>((resolve) => {
      const check = (job: Job) => {
        if (job.id === id) {
          engine.queue.off('finished', check)
          resolve(job)
        }
      }
      engine.queue.on('finished', check)
    })
  const convert = async (file: string, settings: Partial<ConvertSettings>) => {
    const [job] = engine.startConvert([file], { ...base, ...settings })
    return waitFor(job!.id)
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-edge-'))
    engine = await createEngine({
      binDirs: [BIN!],
      dataDir: path.join(dir, 'data'),
      tempDir: path.join(dir, 'tmp'),
      defaultRoot: path.join(dir, 'Sparky'),
      appVersion: 'test',
      skipGpu: true,
      host: {
        trash: async (p) => fs.rmSync(p, { recursive: true, force: true }),
        printToPdf: async (_html, pdf) => fs.writeFileSync(pdf, '%PDF-1.4 test'),
      },
    })
    engine.setSettings({ concurrency: 2 })
    const ffmpeg = path.join(BIN!, 'ffmpeg')
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', path.join(dir, 'clip.mov')])
    await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', path.join(dir, 'tone.wav')])
  }, 120_000)

  afterAll(async () => {
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('handles spaces, brackets and unicode in file names and folders', async () => {
    const folder = path.join(dir, 'Mes vidéos (2026) [raw]')
    fs.mkdirSync(folder)
    const clip = path.join(folder, 'Ünïcødé clip (1) [test] 日本語.mov')
    fs.copyFileSync(path.join(dir, 'clip.mov'), clip)
    const job = await convert(clip, { output: 'mp4' })
    expect(job.status, job.error).toBe('done')
    expect(path.basename(job.outputs[0]!)).toBe('Ünïcødé clip (1) [test] 日本語.mp4')
    expect(fs.existsSync(job.outputs[0]!)).toBe(true)

    const notes = path.join(folder, 'Notes été #1.md')
    fs.writeFileSync(notes, '# Été\n\nCafé & crème.\n')
    const docx = await convert(notes, { output: 'docx' })
    expect(docx.status, docx.error).toBe('done')
    expect(path.basename(docx.outputs[0]!)).toBe('Notes été #1.docx')
  })

  it('accepts a long file name', async () => {
    const long = path.join(dir, `${'long name '.repeat(12).trim()}.wav`)
    fs.copyFileSync(path.join(dir, 'tone.wav'), long)
    const job = await convert(long, { output: 'mp3' })
    expect(job.status, job.error).toBe('done')
    expect(fs.existsSync(job.outputs[0]!)).toBe(true)
  })

  it('fails in plain words when the output folder cannot be created', async () => {
    const root = engine.getSettings().outputRoot
    // A path "inside" a file can never be created.
    engine.setSettings({ outputRoot: path.join(dir, 'clip.mov', 'Sparky') })
    try {
      const job = await convert(path.join(dir, 'tone.wav'), { output: 'mp3' })
      expect(job.status).toBe('failed')
      expect(job.error).toMatch(/folder/i)
      expect(job.error).toMatch(/Settings/)
      expect(job.error).not.toMatch(RAW_TOOL_TEXT)
    } finally {
      engine.setSettings({ outputRoot: root })
    }
  })

  it('keeps both outputs when two files with the same name convert at once', async () => {
    const a = path.join(dir, 'a', 'same.wav')
    const b = path.join(dir, 'b', 'same.wav')
    fs.mkdirSync(path.dirname(a))
    fs.mkdirSync(path.dirname(b))
    fs.copyFileSync(path.join(dir, 'tone.wav'), a)
    fs.copyFileSync(path.join(dir, 'tone.wav'), b)
    const jobs = engine.startConvert([a, b], { ...base, output: 'mp3' })
    const done = await Promise.all(jobs.map((j) => waitFor(j.id)))
    expect(done.map((j) => j.status)).toEqual(['done', 'done'])
    const outputs = done.map((j) => j.outputs[0]!)
    expect(new Set(outputs).size).toBe(2)
    for (const out of outputs) expect(fs.existsSync(out)).toBe(true)
  })

  it('explains a zero-byte file instead of quoting the tool', async () => {
    const zero = path.join(dir, 'zero.mp4')
    fs.writeFileSync(zero, '')
    const job = await convert(zero, { output: 'webm' })
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/damaged|not really/i)
    expect(job.error).not.toMatch(RAW_TOOL_TEXT)
  })

  it.skipIf(!has('7za') && !has('7z'))('explains a corrupt archive instead of quoting the tool', async () => {
    const bad = path.join(dir, 'bad.zip')
    fs.writeFileSync(bad, 'this is not a zip file')
    const job = await convert(bad, { output: '7z' })
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/damaged|not really/i)
    expect(job.error).not.toMatch(RAW_TOOL_TEXT)
  })

  it('converts an .mp4 that is really audio', async () => {
    const fake = path.join(dir, 'fake.mp4')
    fs.copyFileSync(path.join(dir, 'tone.wav'), fake)
    const job = await convert(fake, { output: 'mp4', compression: 4, resolution: 720 })
    expect(job.status, job.error).toBe('done')
    const [p] = await engine.probe([job.outputs[0]!])
    expect(p!.height).toBeUndefined()
    expect(p!.duration).toBeCloseTo(1, 0)
  })

  it('reports a file that vanished before its turn', async () => {
    engine.setSettings({ concurrency: 1 })
    try {
      const gone = path.join(dir, 'gone.wav')
      fs.copyFileSync(path.join(dir, 'tone.wav'), gone)
      const [first, second] = engine.startConvert([path.join(dir, 'clip.mov'), gone], { ...base, output: 'mp3' })
      fs.rmSync(gone)
      await waitFor(first!.id)
      const job = await waitFor(second!.id)
      expect(job.status).toBe('failed')
      expect(job.error).toMatch(/gone|moved|deleted/i)
    } finally {
      engine.setSettings({ concurrency: 2 })
    }
  })

  it('finishes the rest of a batch when one file is broken', async () => {
    const broken = path.join(dir, 'broken.mov')
    fs.writeFileSync(broken, 'nope')
    const jobs = engine.startConvert([path.join(dir, 'clip.mov'), broken, path.join(dir, 'tone.wav')], { ...base, output: 'mp3' })
    const done = await Promise.all(jobs.map((j) => waitFor(j.id)))
    expect(done.map((j) => j.status)).toEqual(['done', 'failed', 'done'])
    expect(done[1]!.error).not.toMatch(RAW_TOOL_TEXT)
  })
})
