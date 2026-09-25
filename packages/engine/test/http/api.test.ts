// The local HTTP API against a real server on a free port. The job tests run the real tools when SPARKY_TEST_BIN is set.
import type { Job } from '@sparky/core'
import { createHmac, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apiPort, createEngine, ensureToken, readToken, startApiServer, tokenPath, type ApiServer, type Engine } from '../../src'
import { run } from '../../src/process'

const BIN = process.env.SPARKY_TEST_BIN
if (process.env.CI && !BIN) throw new Error('Set SPARKY_TEST_BIN in CI so the real-tool tests run.')

interface Reply {
  status: number
  body: Record<string, unknown> & { error?: string; message?: string; field?: string; requestId?: string }
}

function client(server: () => ApiServer) {
  return async (method: string, url: string, opts: { body?: unknown; raw?: string; token?: string | null; signal?: AbortSignal } = {}): Promise<Reply> => {
    const s = server()
    const headers: Record<string, string> = {}
    const token = opts.token === undefined ? s.token : opts.token
    if (token !== null) headers.authorization = `Bearer ${token}`
    let body: string | undefined = opts.raw
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    const res = await fetch(`http://127.0.0.1:${s.port}${url}`, { method, headers, body, signal: opts.signal })
    return { status: res.status, body: (await res.json()) as Reply['body'] }
  }
}

const settle = async <T>(check: () => Promise<T | undefined>, ms = 60_000): Promise<T> => {
  const end = Date.now() + ms
  for (;;) {
    const v = await check()
    if (v !== undefined) return v
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 100))
  }
}

async function makeEngine(dir: string, binDirs: string[]): Promise<Engine> {
  return createEngine({
    binDirs,
    dataDir: path.join(dir, 'data'),
    tempDir: path.join(dir, 'tmp'),
    defaultRoot: path.join(dir, 'Sparky'),
    appVersion: 'test',
    skipGpu: true,
    host: {},
  })
}

describe('api token', () => {
  it('makes a 64-hex token once and reads it back', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-token-'))
    try {
      expect(readToken(dir)).toBeUndefined()
      const t = ensureToken(dir)
      expect(t).toMatch(/^[0-9a-f]{64}$/)
      expect(ensureToken(dir)).toBe(t)
      expect(readToken(dir)).toBe(t)
      expect(tokenPath(dir)).toBe(path.join(dir, 'api-token'))
      if (process.platform !== 'win32') expect(fs.statSync(tokenPath(dir)).mode & 0o777).toBe(0o600)
      fs.writeFileSync(tokenPath(dir), 'damaged')
      expect(readToken(dir)).toBeUndefined()
      expect(ensureToken(dir)).toMatch(/^[0-9a-f]{64}$/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('takes the port from SPARKY_API_PORT, else 8600', () => {
    const was = process.env.SPARKY_API_PORT
    try {
      delete process.env.SPARKY_API_PORT
      expect(apiPort()).toBe(8600)
      process.env.SPARKY_API_PORT = '8611'
      expect(apiPort()).toBe(8611)
      expect(apiPort(0)).toBe(0)
      process.env.SPARKY_API_PORT = 'eighty'
      expect(() => apiPort()).toThrow(/SPARKY_API_PORT/)
    } finally {
      if (was === undefined) delete process.env.SPARKY_API_PORT
      else process.env.SPARKY_API_PORT = was
    }
  })
})

describe('api server', () => {
  let dir: string
  let engine: Engine
  let server: ApiServer
  const api = client(() => server)

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-api-'))
    engine = await makeEngine(dir, [])
    server = await startApiServer(engine, { dataDir: path.join(dir, 'data'), port: 0, host: 'cli', version: '9.9.9' })
  })

  afterAll(async () => {
    await server?.close()
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writes the token file it checks against', () => {
    expect(server.port).toBeGreaterThan(0)
    expect(readToken(path.join(dir, 'data'))).toBe(server.token)
  })

  it('answers health with the token', async () => {
    const r = await api('GET', '/v1/health')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, app: 'sparky', version: '9.9.9', pid: process.pid, host: 'cli' })
  })

  it('refuses health without the token, or with a wrong one', async () => {
    for (const token of [null, 'nope', server.token.replace(/.$/, (c) => (c === '0' ? '1' : '0'))]) {
      const r = await api('GET', '/v1/health', { token })
      expect(r.status).toBe(401)
      expect(r.body.error).toBe('unauthorized')
      expect(r.body.message).toMatch(/token/)
      expect(typeof r.body.requestId).toBe('string')
    }
  })

  it('takes the Bearer scheme in any case and with extra spaces', async () => {
    for (const header of [`bearer ${server.token}`, `BEARER   ${server.token}  `, ` Bearer\t${server.token}`]) {
      const res = await fetch(`http://127.0.0.1:${server.port}/v1/health`, { headers: { authorization: header } })
      expect(res.status, header).toBe(200)
    }
    for (const header of [server.token, `Basic ${server.token}`, `Bearer ${server.token} extra`, `Bearer${server.token}`]) {
      const res = await fetch(`http://127.0.0.1:${server.port}/v1/health`, { headers: { authorization: header } })
      expect(res.status, header).toBe(401)
    }
  })

  it('proves it holds the token to a client that has not sent it', async () => {
    const nonce = randomBytes(16).toString('hex')
    const r = await api('GET', `/v1/hello?nonce=${nonce}`, { token: null })
    expect(r.status).toBe(200)
    const proof = createHmac('sha256', server.token).update(nonce).digest('hex')
    expect(r.body).toEqual({ app: 'sparky', version: '9.9.9', host: 'cli', proof })
    const other = await api('GET', `/v1/hello?nonce=${randomBytes(16).toString('hex')}`, { token: null })
    expect(other.body.proof).not.toBe(proof)
    expect(createHmac('sha256', 'f'.repeat(64)).update(nonce).digest('hex')).not.toBe(proof)
  })

  it('refuses a missing, short, long or non-hex nonce', async () => {
    for (const q of ['', '?nonce=', '?nonce=abc123', `?nonce=${'a'.repeat(65)}`, `?nonce=${'z'.repeat(32)}`]) {
      const r = await api('GET', `/v1/hello${q}`, { token: null })
      expect(r.status, q).toBe(400)
      expect(r.body, q).toMatchObject({ error: 'invalid_request', field: 'nonce' })
    }
    expect((await api('GET', `/v1/hello?nonce=${'A1'.repeat(8)}`, { token: null })).status).toBe(200)
  })

  it('refuses an unknown route without the token before saying it is missing', async () => {
    expect((await api('GET', '/v1/nothing', { token: null })).status).toBe(401)
    const r = await api('GET', '/v1/nothing')
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('not_found')
  })

  it('lists the ops from the registry', async () => {
    const r = await api('GET', '/v1/ops')
    expect(r.status).toBe(200)
    const ops = r.body.ops as { id: string; inputSchema: unknown; available: boolean }[]
    expect(ops.map((o) => o.id)).toEqual(expect.arrayContaining(['convert', 'download', 'pdf.merge', 'ocr']))
    expect(ops.find((o) => o.id === 'convert')?.inputSchema).toMatchObject({ type: 'object' })
  })

  it('lists formats and inputs', async () => {
    const r = await api('GET', '/v1/formats')
    expect(r.status).toBe(200)
    expect((r.body.formats as { ext: string }[]).some((f) => f.ext === 'mp4')).toBe(true)
    expect(r.body.inputs).toContain('csv')
  })

  it('says what a file can become', async () => {
    const r = await api('POST', '/v1/targets', { body: { paths: ['C:/x/data.csv'] } })
    expect(r.status).toBe(200)
    const [t] = r.body.targets as { path: string; targets: { op: string; ext: string }[] }[]
    expect(t!.path).toBe('C:/x/data.csv')
    expect(t!.targets).toContainEqual(expect.objectContaining({ op: 'convert', ext: 'xlsx' }))
  })

  it('gives invalid input 400 with the field', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [], output: 'xlsx' } } })
    expect(r.status).toBe(400)
    expect(r.body).toMatchObject({ error: 'invalid_input', field: 'files' })
    expect(r.body.message).toMatch(/can’t start/)
  })

  it('gives an unknown op 404', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'pdf.juggle', args: {} } })
    expect(r.status).toBe(404)
    expect(r.body).toMatchObject({ error: 'unknown_op', field: 'op' })
  })

  it('gives an op this host cannot run 422', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [path.join(dir, 'page.html')], output: 'pdf' } } })
    expect(r.status).toBe(422)
    expect(r.body.error).toBe('unavailable')
    expect(r.body.message).toMatch(/app is open/)
  })

  it('gives a malformed body 400 invalid_request', async () => {
    const bad = await api('POST', '/v1/jobs', { raw: '{"op":', token: server.token })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('invalid_request')
    const empty = await api('POST', '/v1/jobs', { raw: '' })
    expect(empty.status).toBe(400)
    expect(empty.body.error).toBe('invalid_request')
    const shape = await api('POST', '/v1/jobs', { body: { op: 'convert', args: [], wait: 'yes' } })
    expect(shape.status).toBe(400)
    expect(shape.body).toMatchObject({ error: 'invalid_request', field: 'args' })
    expect(shape.body.message).toMatch(/wait/)
  })

  it('takes a long path list', async () => {
    const paths = Array.from({ length: 20_000 }, (_, i) => `C:/some/long/folder/name/file-${i}.csv`)
    const r = await api('POST', '/v1/targets', { body: { paths } })
    expect(r.status).toBe(200)
    expect(r.body.targets).toHaveLength(20_000)
  })

  it('gives an unknown job 404 on get and delete', async () => {
    for (const method of ['GET', 'DELETE']) {
      const r = await api(method, '/v1/jobs/no-such-job')
      expect(r.status).toBe(404)
      expect(r.body).toMatchObject({ error: 'not_found', field: 'id' })
    }
  })

  it('lists jobs', async () => {
    const r = await api('GET', '/v1/jobs')
    expect(r.status).toBe(200)
    expect(r.body.jobs).toEqual([])
  })

  it('turns anything unexpected into 500 internal_error without the stack', async () => {
    const broken: Engine = {
      ...engine,
      listOps: () => {
        throw new Error('secret detail at C:\\stack')
      },
    }
    const s = await startApiServer(broken, { dataDir: path.join(dir, 'data'), port: 0, host: 'cli', version: 'x' })
    try {
      const r = await client(() => s)('GET', '/v1/ops')
      expect(r.status).toBe(500)
      expect(r.body.error).toBe('internal_error')
      expect(JSON.stringify(r.body)).not.toMatch(/secret|stack|at /)
    } finally {
      await s.close()
    }
  })

  it('refuses to listen anywhere but 127.0.0.1', async () => {
    for (const bind of ['0.0.0.0', '::', 'localhost', '192.168.1.10']) {
      await expect(startApiServer(engine, { dataDir: path.join(dir, 'data'), port: 0, host: 'cli', version: 'x', bind })).rejects.toThrow(/127\.0\.0\.1/)
    }
  })

  it('fails to start when the port is taken, and frees nothing it did not own', async () => {
    await expect(startApiServer(engine, { dataDir: path.join(dir, 'data'), port: server.port, host: 'cli', version: 'x' })).rejects.toThrow(/EADDRINUSE/)
    expect((await api('GET', '/v1/health')).status).toBe(200)
  })
})

describe.skipIf(!BIN)('api jobs with real tools', () => {
  let dir: string
  let engine: Engine
  let server: ApiServer
  const api = client(() => server)
  let csv: string
  let long: string

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-api-jobs-'))
    engine = await makeEngine(dir, [BIN!])
    server = await startApiServer(engine, { dataDir: path.join(dir, 'data'), port: 0, host: 'app', version: 'test' })
    csv = path.join(dir, 'sample.csv')
    fs.copyFileSync(path.join(__dirname, '..', 'fixtures', 'document', 'sample.csv'), csv)
    long = path.join(dir, 'long.mov')
    await run(path.join(BIN!, 'ffmpeg'), ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=30', '-c:v', 'libx264', '-preset', 'ultrafast', long])
  }, 120_000)

  afterAll(async () => {
    await server?.close()
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const getJob = async (id: string) => (await api('GET', `/v1/jobs/${id}`)).body.job as Job

  it('converts csv to xlsx and waits for it', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [csv], output: 'xlsx', out: path.join(dir, 'waited') + path.sep } } })
    expect(r.status).toBe(200)
    const [job] = r.body.jobs as Job[]
    expect(job!.status).toBe('done')
    expect(job!.outputs).toHaveLength(1)
    expect(job!.outputs[0]!.endsWith('.xlsx')).toBe(true)
    expect(fs.readFileSync(job!.outputs[0]!).subarray(0, 2).toString()).toBe('PK')
  })

  it('starts without waiting, then reports the job by id until done', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [csv], output: 'json', out: path.join(dir, 'polled') + path.sep }, wait: false } })
    expect(r.status).toBe(202)
    const [started] = r.body.jobs as Job[]
    const done = await settle(async () => {
      const j = await getJob(started!.id)
      return j.status === 'done' || j.status === 'failed' ? j : undefined
    })
    expect(done.status).toBe('done')
    expect(fs.existsSync(done.outputs[0]!)).toBe(true)
    expect(((await api('GET', '/v1/jobs')).body.jobs as Job[]).map((j) => j.id)).toContain(started!.id)
  })

  it('cancels a running job on DELETE', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [long], output: 'webm', out: path.join(dir, 'canceled') + path.sep }, wait: false } })
    const id = (r.body.jobs as Job[])[0]!.id
    await settle(async () => ((await getJob(id)).status === 'running' ? true : undefined))
    const del = await api('DELETE', `/v1/jobs/${id}`)
    expect(del.status).toBe(200)
    expect((del.body.job as Job).id).toBe(id)
    const end = await settle(async () => {
      const j = await getJob(id)
      return j.status === 'running' ? undefined : j
    })
    expect(end.status).toBe('canceled')
  })

  it('keeps the jobs running when a waiting client hangs up', async () => {
    const hangUp = new AbortController()
    const sent = api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [long], output: 'webm', out: path.join(dir, 'hung') + path.sep } }, signal: hangUp.signal })
    const job = await settle(async () => ((await api('GET', '/v1/jobs')).body.jobs as Job[]).find((j) => j.status === 'running' && (j.args as { out?: string }).out?.includes('hung')))
    hangUp.abort()
    await expect(sent).rejects.toThrow()
    await new Promise((r) => setTimeout(r, 1000))
    expect((await getJob(job.id)).status).toBe('running')
    await api('DELETE', `/v1/jobs/${job.id}`)
  })

  it('returns the jobs as they are when timeoutMs passes first', async () => {
    const r = await api('POST', '/v1/jobs', { body: { op: 'convert', args: { files: [long], output: 'webm', out: path.join(dir, 'timeout') + path.sep }, timeoutMs: 300 } })
    expect(r.status).toBe(200)
    const [job] = r.body.jobs as Job[]
    expect(['queued', 'running']).toContain(job!.status)
    await api('DELETE', `/v1/jobs/${job!.id}`)
  })
})
