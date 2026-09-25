// The built bundle, end to end: the local engine in-process, and the HTTP API through `sparky serve`.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readToken } from '@sparky/engine'
import { RemoteBackend } from '../src/backend'
import { BUNDLE, childEnv, FIXTURES, runCli, tempDir } from './helpers'

const CSV = path.join(FIXTURES, 'document', 'sample.csv')
const PDF = path.join(FIXTURES, 'report.pdf')

let dir: string
let env: NodeJS.ProcessEnv

beforeAll(() => {
  dir = tempDir('sparky-cli-e2e-')
  env = childEnv(path.join(dir, 'data'), { SPARKY_API_PORT: '1' })
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }))

describe('sparky (local engine)', () => {
  it('converts a CSV to XLSX and prints the jobs as JSON', async () => {
    const out = path.join(dir, 'xlsx') + path.sep
    const r = await runCli(['convert', CSV, '--output', 'xlsx', '--out', out, '--json', '--local'], env)
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    const { jobs } = JSON.parse(r.stdout) as { jobs: { status: string; outputs: string[]; op: string }[] }
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ status: 'done', op: 'convert' })
    const file = jobs[0]!.outputs[0]!
    expect(path.dirname(file)).toBe(path.resolve(out))
    expect(fs.readFileSync(file).subarray(0, 2).toString()).toBe('PK')
  })

  it('takes --to for --output and prints only the path without --json', async () => {
    const r = await runCli(['convert', CSV, '--to', 'json', '--out', path.join(dir, 'rows.json'), '--local'], env)
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe(path.join(dir, 'rows.json'))
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'rows.json'), 'utf8')) as Record<string, unknown>[]
    expect(rows[0]).toMatchObject({ name: 'Ada', city: 'London' })
  })

  it('merges PDFs through the registry-generated command', async () => {
    const out = path.join(dir, 'merged.pdf')
    const r = await runCli(['pdf', 'merge', PDF, PDF, '--out', out, '--local'], env)
    expect(r.code).toBe(0)
    expect(fs.readFileSync(out).subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('exits 2 on a usage error, naming the targets it could use', async () => {
    const r = await runCli(['convert', CSV, '--local'], env)
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/needs --output\. It can become: .*xlsx/)
  })

  it('exits 1 when a job fails', async () => {
    const r = await runCli(['convert', path.join(dir, 'missing.csv'), '--to', 'xlsx', '--local'], env)
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/Failed:/)
  })

  it('exits 3 when an op needs a program that is missing', async () => {
    const ops = await runCli(['ops', '--json', '--local'], env)
    const list = (JSON.parse(ops.stdout) as { ops: { id: string; available: boolean }[] }).ops
    const missing = list.find((o) => !o.available && o.id.startsWith('pdf.'))
    if (!missing) return
    const r = await runCli([...missing.id.split('.'), PDF, '--local'], env)
    expect(r.code).toBe(3)
  })

  it('refuses a password typed on the command line', async () => {
    const r = await runCli(['pdf', 'unlock', PDF, '--password', 'hunter2', '--local'], env)
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/can't take the value on the command line.*SPARKY_PASSWORD/)
  })

  it('prints help generated from the schema', async () => {
    const r = await runCli(['pdf', 'split', '--help'], env)
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/--mode <ranges\|every\|pages\|odd_even>/)
  })
})

describe('sparky serve and the remote backend', () => {
  let serve: ChildProcess
  let remoteEnv: NodeJS.ProcessEnv

  beforeAll(async () => {
    serve = spawn(process.execPath, [BUNDLE, 'serve', '--port', '0'], { env, windowsHide: true })
    const port = await new Promise<string>((resolve, reject) => {
      let text = ''
      serve.stdout!.on('data', (d) => {
        text += d
        const m = /127\.0\.0\.1:(\d+)/.exec(text)
        if (m && text.includes('Token file:')) resolve(m[1]!)
      })
      serve.on('exit', (c) => reject(new Error(`serve exited ${c}`)))
    })
    remoteEnv = { ...env, SPARKY_API_PORT: port }
  })
  afterAll(async () => {
    if (!serve || serve.exitCode !== null) return
    const gone = new Promise((r) => serve.once('exit', r))
    serve.kill()
    await gone
  })

  it('sends the job to the API and lists it in the queue', async () => {
    const out = path.join(dir, 'remote') + path.sep
    const r = await runCli(['convert', CSV, '--output', 'md', '--out', out, '--json'], remoteEnv)
    expect(r.code).toBe(0)
    const { jobs } = JSON.parse(r.stdout) as { jobs: { id: string; status: string; outputs: string[] }[] }
    expect(jobs[0]!.status).toBe('done')
    expect(fs.existsSync(jobs[0]!.outputs[0]!)).toBe(true)
    const listed = await runCli(['jobs', '--json'], remoteEnv)
    expect((JSON.parse(listed.stdout) as { jobs: { id: string }[] }).jobs.map((j) => j.id)).toContain(jobs[0]!.id)
  })

  it('queues with --no-wait and returns the id', async () => {
    const r = await runCli(['convert', CSV, '--to', 'txt', '--out', path.join(dir, 'nowait') + path.sep, '--no-wait'], remoteEnv)
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('passes the hello challenge with the right token and refuses a wrong one before sending it', async () => {
    const port = Number(remoteEnv.SPARKY_API_PORT)
    const token = readToken(path.join(dir, 'data'))!
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect((await RemoteBackend.connect({ port, token })).backend).toBeDefined()
    const wrong = await RemoteBackend.connect({ port, token: 'f'.repeat(64) })
    expect(wrong.backend).toBeUndefined()
    expect(wrong.unauthorized).toBeUndefined()
  })

  it('maps an API refusal to exit 2', async () => {
    const r = await runCli(['cancel', '00000000-0000-0000-0000-000000000000'], remoteEnv)
    expect(r.code).toBe(2)
  })
})
