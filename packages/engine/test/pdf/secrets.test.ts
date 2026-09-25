// Passwords never leave the run: not in the queue snapshot, not in History, not on Ghostscript's command line.
// Ghostscript is stood in for by Node under its name, with a preload that records what it was given and writes the output.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEngine, OpInputError, type Engine } from '../../src'
import { makePdf } from './helpers'

const FAKE_GS = `
const fs = require('node:fs')
// Node takes the first argument as its script and makes it absolute, so "@C:/x.args" arrives as "<cwd>/@C:/x.args".
const args = process.argv.slice(1)
const at = args[0].includes('@') ? args[0].slice(args[0].indexOf('@') + 1) : undefined
const out = args.find((a) => a.startsWith('-sOutputFile=')).slice('-sOutputFile='.length)
fs.writeFileSync(process.env.FAKE_GS_LOG, JSON.stringify({ args, argFile: at, argText: at && fs.readFileSync(at, 'utf8') }))
fs.copyFileSync(args[args.length - 1], out)
process.exit(0)
`

describe('secret fields', () => {
  let dir: string
  let engine: Engine
  let log: string
  const saved = { NODE_OPTIONS: process.env.NODE_OPTIONS, FAKE_GS_LOG: process.env.FAKE_GS_LOG }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-secret-'))
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(bin)
    const gs = path.join(bin, process.platform === 'win32' ? 'gswin64c.exe' : 'gs')
    try {
      fs.linkSync(process.execPath, gs)
    } catch {
      fs.copyFileSync(process.execPath, gs)
    }
    const preload = path.join(dir, 'fake-gs.cjs')
    fs.writeFileSync(preload, FAKE_GS)
    log = path.join(dir, 'gs-log.json')
    // NODE_OPTIONS drops backslashes inside quotes.
    process.env.NODE_OPTIONS = `--require "${preload.split(path.sep).join('/')}"`
    process.env.FAKE_GS_LOG = log
    engine = await createEngine({ binDirs: [bin], dataDir: path.join(dir, 'data'), tempDir: path.join(dir, 'tmp'), defaultRoot: path.join(dir, 'Sparky'), appVersion: 'test', host: {}, skipGpu: true })
  })

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 })
  })

  it('tells the surfaces which fields are secret', () => {
    const ops = engine.listOps()
    expect(ops.find((o) => o.id === 'pdf.protect')?.secret).toEqual(['userPassword', 'ownerPassword'])
    expect(ops.find((o) => o.id === 'pdf.unlock')?.secret).toEqual(['password'])
    expect(ops.find((o) => o.id === 'pdf.merge')?.secret).toEqual([])
  })

  it('runs pdf.protect with the passwords, and keeps them out of the queue, History and the command line', async () => {
    const file = await makePdf(path.join(dir, 'doc.pdf'), 1)
    const snapshots: string[] = []
    const onChange = (jobs: unknown) => snapshots.push(JSON.stringify(jobs))
    engine.on('change', onChange)
    const [job] = await engine.runOp('pdf.protect', { files: [file], userPassword: 'hunter two', ownerPassword: 'b"oss\\' })
    engine.off('change', onChange)

    expect(job!.error).toBeUndefined()
    expect(job!.status).toBe('done')
    expect(fs.existsSync(job!.outputs[0]!)).toBe(true)

    const ran = JSON.parse(fs.readFileSync(log, 'utf8')) as { args: string[]; argFile: string; argText: string }
    expect(ran.args.join(' ')).not.toMatch(/hunter|oss|Password/)
    expect(ran.argText).toContain('-dUserPassword=<68756e7465722074776f>')
    expect(ran.argText).toContain('-dOwnerPassword=<62226f73735c>')
    expect(fs.existsSync(ran.argFile)).toBe(false)

    const seen = [...snapshots, JSON.stringify(engine.listJobs()), JSON.stringify(job), JSON.stringify(engine.history({}))]
    for (const s of seen) expect(s).not.toMatch(/hunter|oss|userPassword|ownerPassword/)
    expect(engine.history({})[0]).toMatchObject({ op: 'pdf.protect', args: { files: [file] } })
  })

  it('reruns a job that was given no password', async () => {
    // The stand-in can't run without an @argfile first (Node reads "-sDEVICE" as its own option), so this job fails; its History row is what counts.
    const [job] = await engine.runOp('pdf.unlock', { files: [path.join(dir, 'doc.pdf')] })
    const row = engine.history({}).find((h) => h.id === job!.id)!
    const again = engine.rerun(row.id)
    expect(again).toHaveLength(1)
  })

  it('refuses to rerun a job whose password was not kept', () => {
    const row = engine.history({}).find((h) => h.op === 'pdf.protect')!
    let err: unknown
    try {
      engine.rerun(row.id)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(OpInputError)
    expect((err as OpInputError).message).toMatch(/never keeps passwords/)
  })

  it('hands pdf.unlock its password through the argfile only', async () => {
    const [job] = await engine.runOp('pdf.unlock', { files: [path.join(dir, 'doc.pdf')], password: 'sesame' })
    expect(job!.status).toBe('done')
    expect(JSON.stringify(job)).not.toContain('sesame')
    const ran = JSON.parse(fs.readFileSync(log, 'utf8')) as { argText: string }
    expect(ran.argText).toContain('-dPDFPassword=<736573616d65>')
  })
})
