// One interface over the two ways to run a job: the open app's HTTP API (jobs show in its Queue), or the engine in this process.
import { FORMATS, INPUT_EXTS, JOB_REMOVED_FROM_QUEUE, type FormatInfo, type HistoryEntry, type HistoryQuery, type Job } from '@sparky/core'
import { createEngine, OpInputError, readToken, type Engine, type EnginePaths, type OpInfo, type TargetInfo } from '@sparky/engine'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import http from 'node:http'
import { BackendError, messageOf } from './errors'
import { cliApiPort, cliPaths, localForced, VERSION } from './env'

export interface FormatsInfo {
  formats: FormatInfo[]
  inputs: string[]
}

export interface FileTargets {
  path: string
  targets: TargetInfo[]
}

export interface RunOptions {
  signal?: AbortSignal
  timeoutMs?: number
  onUpdate?(jobs: Job[]): void
}

export interface Backend {
  readonly kind: 'remote' | 'local'
  listOps(): Promise<OpInfo[]>
  listFormats(): Promise<FormatsInfo>
  targetsFor(paths: string[]): Promise<FileTargets[]>
  startOp(op: string, args: Record<string, unknown>): Promise<Job[]>
  runOp(op: string, args: Record<string, unknown>, opts?: RunOptions): Promise<Job[]>
  getJob(id: string): Promise<Job | undefined>
  listJobs(): Promise<Job[]>
  history(q: HistoryQuery): Promise<HistoryEntry[]>
  cancelJob(id: string): Promise<Job | undefined>
  close(): Promise<void>
}

const SETTLED = new Set<Job['status']>(['done', 'failed', 'canceled', 'paused'])

export const isSettled = (j: Job) => SETTLED.has(j.status)

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(done, ms)
    function done() {
      clearTimeout(t)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })

async function startAndWait(b: Backend, op: string, args: Record<string, unknown>, opts: RunOptions, pollMs: number): Promise<Job[]> {
  const { signal, timeoutMs, onUpdate } = opts
  if (signal?.aborted) throw new BackendError('canceled', 'Canceled before it started.')
  let jobs = await b.startOp(op, args)
  const ids = jobs.map((j) => j.id)
  const cancel = () => void Promise.all(ids.map((id) => b.cancelJob(id).catch(() => undefined)))
  signal?.addEventListener('abort', cancel, { once: true })
  const until = timeoutMs === undefined ? Infinity : Date.now() + timeoutMs
  try {
    onUpdate?.(jobs)
    while (!jobs.every(isSettled) && Date.now() < until) {
      await sleep(pollMs, signal)
      if (signal?.aborted) {
        await sleep(pollMs)
      }
      jobs = await Promise.all(
        jobs.map((old) => (isSettled(old) ? old : b.getJob(old.id).then((j): Job => j ?? { ...old, status: 'canceled', note: JOB_REMOVED_FROM_QUEUE }))),
      )
      onUpdate?.(jobs)
      if (signal?.aborted) break
    }
    return jobs
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}


interface ErrorBody {
  error?: string
  message?: string
  field?: string
}

export interface RemoteOptions {
  port: number
  token: string
  probeMs?: number
}

export class RemoteBackend implements Backend {
  readonly kind = 'remote'
  private readonly base: string

  private constructor(private readonly opts: RemoteOptions) {
    this.base = `http://127.0.0.1:${opts.port}`
  }

  static async connect(opts: RemoteOptions): Promise<{ backend?: RemoteBackend; unauthorized?: boolean }> {
    const b = new RemoteBackend(opts)
    try {
      if (!(await b.provesToken(opts.probeMs ?? 1500))) return {}
      const res = await b.request('GET', '/v1/health', undefined, opts.probeMs ?? 1500)
      if (res.status === 401) return { unauthorized: true }
      const body = res.data as { ok?: unknown; app?: unknown } | undefined
      return res.status === 200 && body?.ok === true && body.app === 'sparky' ? { backend: b } : {}
    } catch {
      return {}
    }
  }

  private async provesToken(timeoutMs: number): Promise<boolean> {
    const nonce = randomBytes(16).toString('hex')
    const res = await this.request('GET', `/v1/hello?nonce=${nonce}`, undefined, timeoutMs, false)
    const body = res.data as { app?: unknown; proof?: unknown } | undefined
    if (res.status !== 200 || body?.app !== 'sparky' || typeof body.proof !== 'string' || !/^[0-9a-f]{64}$/i.test(body.proof)) return false
    const want = createHmac('sha256', this.opts.token).update(nonce).digest()
    return timingSafeEqual(want, Buffer.from(body.proof, 'hex'))
  }

  private request(method: string, url: string, body?: unknown, timeoutMs?: number, auth = true): Promise<{ status: number; data: unknown }> {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    return new Promise((resolve, reject) => {
      const req = http.request(
        `${this.base}${url}`,
        {
          method,
          agent: false,
          headers: {
            ...(auth ? { Authorization: `Bearer ${this.opts.token}` } : {}),
            Connection: 'close',
            ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }),
          },
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('error', reject)
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8')
            let data: unknown
            try {
              data = text ? JSON.parse(text) : undefined
            } catch {
              data = undefined
            }
            resolve({ status: res.statusCode ?? 0, data })
          })
        },
      )
      req.on('error', reject)
      if (timeoutMs !== undefined) req.setTimeout(timeoutMs, () => req.destroy(new Error(`No answer in ${timeoutMs} ms`)))
      req.end(payload)
    })
  }

  private async call<T>(method: string, url: string, body?: unknown): Promise<T> {
    let res: { status: number; data: unknown }
    try {
      res = await this.request(method, url, body)
    } catch (e) {
      throw new BackendError('unreachable', `Lost the connection to the Sparky app (${messageOf(e)}).`)
    }
    if (res.status < 200 || res.status >= 300) {
      const e = (res.data ?? {}) as ErrorBody
      throw new BackendError(e.error ?? `http_${res.status}`, e.message ?? `The Sparky app answered ${res.status}.`, e.field, res.status)
    }
    return res.data as T
  }

  async listOps() {
    return (await this.call<{ ops: OpInfo[] }>('GET', '/v1/ops')).ops
  }
  async listFormats() {
    return this.call<FormatsInfo>('GET', '/v1/formats')
  }
  async targetsFor(paths: string[]) {
    return (await this.call<{ targets: FileTargets[] }>('POST', '/v1/targets', { paths })).targets
  }
  async startOp(op: string, args: Record<string, unknown>) {
    return (await this.call<{ jobs: Job[] }>('POST', '/v1/jobs', { op, args, wait: false })).jobs
  }
  runOp(op: string, args: Record<string, unknown>, opts: RunOptions = {}) {
    return startAndWait(this, op, args, opts, 400)
  }
  async getJob(id: string) {
    try {
      return (await this.call<{ job: Job }>('GET', `/v1/jobs/${encodeURIComponent(id)}`)).job
    } catch (e) {
      if (e instanceof BackendError && e.code === 'not_found') return undefined
      throw e
    }
  }
  async listJobs() {
    return (await this.call<{ jobs: Job[] }>('GET', '/v1/jobs')).jobs
  }
  async history(q: HistoryQuery) {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    return (await this.call<{ entries: HistoryEntry[] }>('GET', `/v1/history${params.size ? `?${params}` : ''}`)).entries
  }
  async cancelJob(id: string) {
    try {
      return (await this.call<{ job: Job }>('DELETE', `/v1/jobs/${encodeURIComponent(id)}`)).job
    } catch (e) {
      if (e instanceof BackendError && e.code === 'not_found') return undefined
      throw e
    }
  }
  async close() {}
}


export function createLocalEngine(paths: EnginePaths = cliPaths()): Promise<Engine> {
  return createEngine({ ...paths, appVersion: VERSION, host: {}, skipGpu: false })
}

function wrap<T>(f: () => T): T {
  try {
    return f()
  } catch (e) {
    if (e instanceof OpInputError) throw new BackendError(e.code, e.message, e.field)
    throw e
  }
}

export class LocalBackend implements Backend {
  readonly kind = 'local'
  private constructor(readonly engine: Engine) {}

  static async create(paths: EnginePaths = cliPaths()): Promise<LocalBackend> {
    return new LocalBackend(await createLocalEngine(paths))
  }

  async listOps() {
    return this.engine.listOps()
  }
  async listFormats() {
    return { formats: [...FORMATS], inputs: [...INPUT_EXTS] }
  }
  async targetsFor(paths: string[]) {
    return this.engine.targetsFor(paths)
  }
  async startOp(op: string, args: Record<string, unknown>) {
    return wrap(() => this.engine.startOp(op, args))
  }
  runOp(op: string, args: Record<string, unknown>, opts: RunOptions = {}) {
    return startAndWait(this, op, args, opts, 150)
  }
  async getJob(id: string) {
    return this.engine.getJob(id)
  }
  async listJobs() {
    return this.engine.listJobs()
  }
  async history(q: HistoryQuery) {
    return this.engine.history(q)
  }
  async cancelJob(id: string) {
    if (!this.engine.getJob(id)) return undefined
    this.engine.cancelJob(id)
    return this.engine.getJob(id)
  }
  async close() {
    await this.engine.shutdown()
  }
}

export interface PickOptions {
  local?: boolean
  paths?: EnginePaths
  warn?(message: string): void
}

export async function connectRemote(paths: EnginePaths, warn?: (m: string) => void): Promise<RemoteBackend | undefined> {
  const token = readToken(paths.dataDir)
  if (!token) return undefined
  const { backend, unauthorized } = await RemoteBackend.connect({ port: cliApiPort(), token })
  if (unauthorized) warn?.('The Sparky app refused the saved API token; running here instead.')
  return backend
}

export async function pickBackend(opts: PickOptions = {}): Promise<Backend> {
  const paths = opts.paths ?? cliPaths()
  if (!opts.local && !localForced()) {
    const remote = await connectRemote(paths, opts.warn)
    if (remote) return remote
  }
  return LocalBackend.create(paths)
}
