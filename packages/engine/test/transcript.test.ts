import { explainYtDlpError, TRANSCRIPT_TEXT } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { allOps, createEngine, inputSchema, opById, type Engine } from '../src'

// A stand-in for yt-dlp: the real engine runs the op, but the process runner answers for this one file.
// Links name the case: "nocaps" saves nothing, "broken" fails, anything else saves "Talk <id>.en.vtt".
const fake = vi.hoisted(() => ({ file: 'yt-dlp', calls: [] as string[][] }))
vi.mock('../src/process', async (orig) => {
  const real = await orig<typeof import('../src/process')>()
  return {
    ...real,
    run: async (cmd: string, args: string[], opts?: Parameters<typeof real.run>[2]) => {
      if (path.basename(cmd).replace(/\.exe$/, '') !== fake.file) return real.run(cmd, args, opts)
      if (args[0] === '--version') return { code: 0, stdout: '2099.01.01', stderr: '' }
      fake.calls.push(args)
      const url = args[args.length - 1]!
      const dir = args[args.indexOf('-P') + 1]!
      if (url.includes('broken')) return { code: 1, stdout: '', stderr: 'ERROR: Video unavailable' }
      if (!url.includes('nocaps')) {
        const id = url.split('/').pop()!
        fs.writeFileSync(path.join(dir, `Talk [${id}].en.vtt`), ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', `words of ${id}`, ''].join('\n'))
      }
      return { code: 0, stdout: '', stderr: '' }
    },
  }
})

describe('transcript op', () => {
  it('is registered, takes links and needs yt-dlp', () => {
    const op = opById('transcript')
    expect(op).toBeDefined()
    expect(op!.requires).toEqual(['yt-dlp'])
    expect(op!.positional).toEqual(['urls'])
    expect(allOps().map((o) => o.id)).toContain('transcript')
  })

  it('says several links make several files, so `out` cannot name one file', () => {
    const op = opById('transcript')!
    expect(op.many?.({ urls: ['a', 'b'] })).toBe(true)
    expect(op.many?.({ urls: ['a'] })).toBe(false)
  })

  it('words every field and tells the agent nothing is downloaded but captions', () => {
    const props = inputSchema(opById('transcript')!).properties as Record<string, { title?: string; description?: string }>
    for (const name of ['urls', 'langs', 'timestamps']) {
      expect(props[name]!.title, name).toBeTruthy()
      expect(props[name]!.description, name).toBeTruthy()
    }
    expect(TRANSCRIPT_TEXT.fields.urls.description).toMatch(/captions/)
  })
})

describe('transcript op run', () => {
  let dir: string
  let engine: Engine
  const leftovers = () => fs.readdirSync(path.join(dir, 'tmp')).flatMap((p) => fs.readdirSync(path.join(dir, 'tmp', p))).filter((f) => f.startsWith('transcript-'))

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-transcript-'))
    fs.mkdirSync(path.join(dir, 'bin'))
    fs.writeFileSync(path.join(dir, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'), '')
    engine = await createEngine({ binDirs: [path.join(dir, 'bin')], dataDir: path.join(dir, 'data'), tempDir: path.join(dir, 'tmp'), defaultRoot: path.join(dir, 'out'), appVersion: 'test', host: {}, skipGpu: true })
  })
  afterAll(async () => {
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('saves one link as a text file and removes its work folder', async () => {
    const [job] = await engine.runOp('transcript', { urls: ['https://video.test/abc'] })
    expect(job, job?.error).toMatchObject({ status: 'done', op: 'transcript' })
    expect(path.basename(job!.outputs[0]!)).toBe('Talk [abc] (transcript).txt')
    expect(fs.readFileSync(job!.outputs[0]!, 'utf8')).toBe('words of abc\n')
    expect(fake.calls.at(-1)).toEqual(expect.arrayContaining(['--skip-download', '--no-playlist']))
    expect(leftovers()).toEqual([])
  })

  it('makes one file per link', async () => {
    const jobs = await engine.runOp('transcript', { urls: ['https://video.test/one', 'https://video.test/two'] })
    expect(jobs.map((j) => j.status)).toEqual(['done', 'done'])
    const files = jobs.flatMap((j) => j.outputs.map((o) => path.basename(o))).sort()
    expect(files).toEqual(['Talk [one] (transcript).txt', 'Talk [two] (transcript).txt'])
    expect(jobs.flatMap((j) => j.outputs).map((o) => fs.existsSync(o))).toEqual([true, true])
    expect(leftovers()).toEqual([])
  })

  it('tells the agent to download the audio when there are no captions, and cleans up', async () => {
    const [job] = await engine.runOp('transcript', { urls: ['https://video.test/nocaps'] })
    expect(job).toMatchObject({ status: 'failed' })
    expect(job!.error).toBe(TRANSCRIPT_TEXT.noCaptions)
    expect(job!.error).toMatch(/download the audio/)
    expect(leftovers()).toEqual([])
  })

  it('explains a yt-dlp failure in plain words and cleans up', async () => {
    const [job] = await engine.runOp('transcript', { urls: ['https://video.test/broken'] })
    expect(job).toMatchObject({ status: 'failed' })
    expect(job!.error).toBe(explainYtDlpError('ERROR: Video unavailable').message)
    expect(job!.error).not.toMatch(/^ERROR:/)
    expect(leftovers()).toEqual([])
  })
})
