import { defaultSettings, type ConvertSettings, type DownloadRequest } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { convertArgs, createEngine, defaultPaths, downloadArgs, inputSchema, listOps, opById, OpInputError, OPS, RESERVED_INPUTS } from '../src'
import { progressPatch } from '../src/ops/fields'
import { parseOpInput, splitInput } from '../src/ops/run'
import { CanceledError } from '../src/process'
import { JobQueue } from '../src/queue'

const dirs: string[] = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-ops-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })))

const inputError = (fn: () => unknown): OpInputError => {
  try {
    fn()
  } catch (e) {
    if (e instanceof OpInputError) return e
    throw e
  }
  throw new Error('expected an OpInputError')
}

describe('op registry', () => {
  it('gives every op a unique id and a JSON schema with the engine’s out field', () => {
    const ids = OPS.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const op of OPS) {
      const js = inputSchema(op)
      expect(js.type).toBe('object')
      expect(js).not.toHaveProperty('$schema')
      expect(JSON.stringify(js)).not.toContain(String(Number.MAX_SAFE_INTEGER))
      expect(Object.keys(js.properties as object)).toContain('out')
      for (const p of op.positional) expect(Object.keys(op.input.shape), `${op.id} positional ${p}`).toContain(p)
    }
  })

  it('never lets an op declare a name the surfaces keep for themselves', () => {
    for (const op of OPS) for (const name of RESERVED_INPUTS) expect(Object.keys(op.input.shape), `${op.id}.${name}`).not.toContain(name)
  })

  it('lists ops for the surfaces', () => {
    expect(listOps().find((o) => o.id === 'convert')).toMatchObject({ kind: 'convert', arity: 'each', positional: ['files'], doneLabel: 'Converted' })
    expect(listOps().find((o) => o.id === 'download')).toMatchObject({ kind: 'download', requires: ['yt-dlp'], doneLabel: 'Downloaded' })
  })

  it('names the field that is wrong', () => {
    const e = inputError(() => parseOpInput(opById('convert')!, { files: ['a.mov'], output: 'mp4', compression: 9 }))
    expect(e.code).toBe('invalid_input')
    expect(e.field).toBe('compression')
    expect(inputError(() => parseOpInput(opById('convert')!, { output: 'mp4' })).field).toBe('files')
  })

  it('splits an each op into one input per file, keeps out apart, and makes paths absolute', () => {
    const op = opById('convert')!
    const { args, out } = parseOpInput(op, { files: ['a.mov', 'b.mov'], output: 'mp4', out: 'x/' })
    expect(out).toBe(path.resolve('x') + path.sep)
    expect(parseOpInput(op, { files: ['a.mov'], output: 'mp4', out: 'y.mp4' }).out).toBe(path.resolve('y.mp4'))
    expect(args).not.toHaveProperty('out')
    expect(splitInput(op, args).map((a) => a.files)).toEqual([[path.resolve('a.mov')], [path.resolve('b.mov')]])
  })

  it('round-trips the app’s settings through the flat input', () => {
    const s = defaultSettings('/root')
    const convert: ConvertSettings = { output: 'webm', compression: 3, resolution: 1080, performance: 'max', originals: 'keep', advanced: { width: 320, trimStart: 1.5 } }
    const cArgs = parseOpInput(opById('convert')!, convertArgs(['a.mov'], convert)).args
    expect(opById('convert')!.describe!(cArgs, s).convert).toEqual(convert)
    expect(opById('convert')!.describe!(parseOpInput(opById('convert')!, { files: ['a.mov'], output: 'mp3' }).args, s).convert).toMatchObject({ compression: s.compression, resolution: null, originals: 'keep' })

    const req: DownloadRequest = { url: 'https://x', title: 'T', mode: 'audio', quality: 720, convertTo: 'mp3', compression: 1, performance: 'low', extras: { ...s.downloadExtras, sponsorBlock: true } }
    const dArgs = parseOpInput(opById('download')!, downloadArgs(req)).args
    expect(opById('download')!.describe!(dArgs, s).download).toEqual(req)
  })

  it('maps progress onto the job, clearing what is passed as undefined', () => {
    expect(progressPatch({ fraction: null })).toEqual({ progress: -1 })
    expect(progressPatch({ fraction: 0.5, speed: undefined })).toEqual({ progress: 0.5, speed: undefined })
    expect(progressPatch({ note: 'x' })).not.toHaveProperty('progress')
  })
})

describe('JobQueue.whenSettled', () => {
  it('resolves when a job finishes or fails', async () => {
    const q = new JobQueue(async (job) => {
      if (job.title === 'bad') throw new Error('nope')
      return { outputs: ['x'] }
    }, 2)
    const a = q.add({ kind: 'convert', title: 'ok', source: 'a' })
    const b = q.add({ kind: 'convert', title: 'bad', source: 'b' })
    expect(a.op).toBe('convert')
    const [da, db] = await Promise.all([q.whenSettled(a.id), q.whenSettled(b.id)])
    expect(da).toMatchObject({ status: 'done', outputs: ['x'] })
    expect(db).toMatchObject({ status: 'failed', error: 'nope' })
    expect(await q.whenSettled(a.id)).toMatchObject({ status: 'done' })
    expect(await q.whenSettled('missing')).toBeUndefined()
  })

  it('resolves on pause, and only restarting jobs lose their progress', async () => {
    const q = new JobQueue(
      (_job, ctx) =>
        new Promise((_resolve, reject) => {
          ctx.update({ progress: 0.5 })
          ctx.signal.addEventListener('abort', () => reject(new CanceledError('pause')))
        }),
      2,
    )
    const restart = q.add({ kind: 'convert', title: 'r', source: 'r', restartsOnResume: true })
    const resume = q.add({ kind: 'download', title: 'd', source: 'd' })
    await new Promise((r) => setTimeout(r, 10))
    const settled = Promise.all([q.whenSettled(restart.id), q.whenSettled(resume.id)])
    q.pauseAll()
    const [r, d] = await settled
    expect(r).toMatchObject({ status: 'paused', progress: 0 })
    expect(d).toMatchObject({ status: 'paused', progress: 0.5 })
  })
})

describe('engine outside the app', () => {
  const make = async (tempDir = path.join(tmp(), 'tmp')) => {
    const dir = tmp()
    return createEngine({ binDirs: [], dataDir: path.join(dir, 'data'), tempDir, defaultRoot: path.join(dir, 'out'), appVersion: 'test', host: {}, skipGpu: true })
  }

  it('refuses up front what only the app or a missing tool could do', async () => {
    const engine = await make()
    try {
      const print = inputError(() => engine.startOp('convert', { files: ['a.md'], output: 'pdf' }))
      expect(print.code).toBe('unavailable')
      expect(print.message).toMatch(/Sparky app is open/)
      expect(inputError(() => engine.startOp('convert', { files: ['a.wav'], output: 'mp3', originals: 'trash' })).code).toBe('unavailable')
      expect(inputError(() => engine.startOp('download', { urls: ['https://example.com/v'] })).message).toMatch(/Reinstalling Sparky/)
      expect(inputError(() => engine.startOp('nope', {}))).toMatchObject({ code: 'unknown_op', field: 'op' })
      expect(inputError(() => engine.startOp('convert', { files: ['a.wav', 'b.wav'], output: 'mp3', out: path.join(tmp(), 'one.mp3') }))).toMatchObject({ code: 'invalid_input', field: 'out' })
      expect(engine.listJobs()).toEqual([])
      expect(engine.listOps().find((o) => o.id === 'download')).toMatchObject({ available: false, missing: ['yt-dlp'] })
      const [docx] = engine.targetsFor(['C:/a/report.docx'])
      expect(docx!.targets.find((t) => t.ext === 'pdf')).toMatchObject({ op: 'convert', available: false })
    } finally {
      await engine.shutdown()
    }
  })

  it('runs a job to a settled state and fails it in plain words', async () => {
    const engine = await make()
    try {
      const [job] = await engine.runOp('convert', { files: [path.join(tmp(), 'gone.wav')], output: 'mp3' })
      expect(job).toMatchObject({ status: 'failed', op: 'convert', kind: 'convert', restartsOnResume: true })
      expect(job!.error).toMatch(/gone|moved|deleted/i)
      expect(engine.history({})[0]).toMatchObject({ id: job!.id, op: 'convert', args: { files: [expect.any(String)], output: 'mp3' } })
      await expect(engine.runOp('convert', { files: ['a.wav'], output: 'mp3' }, { signal: AbortSignal.abort() })).rejects.toBeInstanceOf(CanceledError)
    } finally {
      await engine.shutdown()
    }
  })

  it('sweeps only the scratch folders of processes that are gone', async () => {
    const root = path.join(tmp(), 'tmp')
    for (const name of ['99999996', String(process.ppid), 'print-left-over']) fs.mkdirSync(path.join(root, name), { recursive: true })
    const engine = await make(root)
    try {
      expect(fs.readdirSync(root).sort()).toEqual([String(process.pid), String(process.ppid)].sort())
    } finally {
      await engine.shutdown()
    }
    expect(fs.existsSync(path.join(root, String(process.pid)))).toBe(false)
  })

  it('finds the app’s data folder without Electron', () => {
    expect(path.basename(defaultPaths().dataDir)).toBe('Sparky')
  })
})
