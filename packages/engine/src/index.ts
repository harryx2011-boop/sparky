// The engine as one object: ops, queue, tools, history and settings. Knows nothing about Electron.
import {
  batchConcurrency,
  opUnavailableError,
  OUT_NEEDS_FOLDER,
  secretNotKeptError,
  unknownOpError,
  type ConvertSettings,
  type DownloadRequest,
  type HistoryEntry,
  type HistoryQuery,
  type Job,
  type LinkInfo,
  type ProbeResult,
  type Settings,
  type SystemInfo,
} from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { probeFiles, type EngineEnv, type EngineHost } from './convert'
import { inspectLink, updateYtDlp } from './download'
import { convertArgs, describeOp, downloadArgs, allOps, opById, OpInputError, type Capability, type OpDescriptor } from './ops'
import { jobFields, parseOpInput, runOpJob, SECRET_GIVEN, splitInput, splitSecrets } from './ops/run'
import { splitOut } from './output'
import { CanceledError } from './process'
import { JobQueue } from './queue'
import { Store } from './store'
import { detectGpu, locateTools, toolStatuses } from './tools'

export interface EngineOptions {
  /** Folders searched for bundled tools, most preferred first. */
  binDirs: string[]
  /** Where the SQLite file lives. */
  dataDir: string
  /** Scratch root; each process works in its own `<tempDir>/<pid>`. */
  tempDir: string
  /** Default output root, e.g. Downloads\Sparky. */
  defaultRoot: string
  appVersion: string
  host: EngineHost
  /** Skip the graphics card test (used by tests). */
  skipGpu?: boolean
}

export interface OpInfo extends OpDescriptor {
  /** Everything the op itself requires is here. */
  available: boolean
  missing: Capability[]
}

export interface TargetInfo {
  op: string
  ext: string
  available: boolean
  missing: Capability[]
}

export interface RunOpOptions {
  /** Aborting cancels every job this call started. */
  signal?: AbortSignal
  /** Stop waiting after this long and return the jobs as they are; they keep running. */
  timeoutMs?: number
}

export interface EngineEvents {
  change: [jobs: Job[]]
  finished: [job: Job]
}

export interface Engine {
  listOps(): OpInfo[]
  /** What each file can become, across every op that takes it. */
  targetsFor(paths: string[]): { path: string; targets: TargetInfo[] }[]
  /** Validates, then queues one job per item for 'each' ops. Throws OpInputError before anything is queued. */
  startOp(op: string, args: unknown): Job[]
  /** startOp, then waits until every job is done, failed, canceled or paused. */
  runOp(op: string, args: unknown, opts?: RunOpOptions): Promise<Job[]>
  getJob(id: string): Job | undefined
  listJobs(): Job[]
  cancelJob(id: string): void
  pause(id: string): void
  resume(id: string): void
  retry(id: string): void
  remove(id: string): void
  reorder(ids: string[]): void
  pauseAll(): void
  resumeAll(): void
  clearFinished(): void
  on<E extends keyof EngineEvents>(event: E, listener: (...args: EngineEvents[E]) => void): void
  off<E extends keyof EngineEvents>(event: E, listener: (...args: EngineEvents[E]) => void): void
  startConvert(paths: string[], convert: ConvertSettings): Job[]
  startDownload(req: DownloadRequest): Job
  history(q: HistoryQuery): HistoryEntry[]
  /** Runs a History entry again, re-validated. */
  rerun(id: string): Job[]
  removeHistory(id: string): void
  clearHistory(): void
  getSettings(): Settings
  setSettings(patch: Partial<Settings>): Settings
  systemInfo(): Promise<SystemInfo>
  probe(paths: string[]): Promise<ProbeResult[]>
  inspect(url: string): Promise<LinkInfo>
  updateYtDlp(): Promise<{ ok: boolean; message: string }>
  shutdown(): Promise<void>
}

export interface EnginePaths {
  dataDir: string
  tempDir: string
  defaultRoot: string
  binDirs: string[]
}

/** The same places the app uses, found without Electron, so a CLI shares its history, settings and tools. */
export function defaultPaths(): EnginePaths {
  const home = os.homedir()
  const dataDir = path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Sparky')
  const programs = path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), 'Programs')
  return {
    dataDir,
    tempDir: path.join(os.tmpdir(), 'Sparky'),
    defaultRoot: path.join(home, 'Downloads', 'Sparky'),
    // yt-dlp's writable copy first, then the installed app's bundle.
    binDirs: [path.join(dataDir, 'bin'), path.join(programs, 'Sparky', 'resources', 'bin'), path.join(programs, 'sparky', 'resources', 'bin')],
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Clears what crashed or force-quit processes left behind, never a live process's folder. */
function sweepTemp(root: string): void {
  for (const name of fs.readdirSync(root)) {
    const pid = /^\d+$/.test(name) ? Number(name) : undefined
    if (pid !== undefined && (pid === process.pid || alive(pid))) continue
    try {
      fs.rmSync(path.join(root, name), { recursive: true, force: true })
    } catch {
      /* a locked leftover waits for the next start; it must never stop this one */
    }
  }
}

export async function createEngine(opts: EngineOptions): Promise<Engine> {
  fs.mkdirSync(opts.dataDir, { recursive: true })
  fs.mkdirSync(opts.tempDir, { recursive: true })
  sweepTemp(opts.tempDir)
  const tempDir = path.join(opts.tempDir, String(process.pid))
  fs.mkdirSync(tempDir, { recursive: true })
  const store = new Store(path.join(opts.dataDir, 'sparky.db'))
  let settings = store.loadSettings(opts.defaultRoot)
  const tools = locateTools(opts.binDirs)
  const gpu = opts.skipGpu ? { encoders: [], label: 'Not checked' } : await detectGpu(tools.ffmpeg)

  const env: EngineEnv = {
    tools,
    gpu,
    cores: os.availableParallelism(),
    settings: () => settings,
    host: opts.host,
    tempDir,
    dataDir: opts.dataDir,
  }

  const atOnce = (s: Settings) => batchConcurrency(s.performance, env.cores, s.batch)
  // Secret fields (passwords) live only here, keyed by job id: never in the job, its snapshots or History.
  const secrets = new Map<string, Record<string, unknown>>()
  const queue = new JobQueue((job, ctx) => runOpJob(env, job, ctx, secrets.get(job.id)), atOnce(settings))
  queue.on('change', (jobs) => {
    if (!secrets.size) return
    const live = new Set(jobs.map((j) => j.id))
    for (const id of secrets.keys()) if (!live.has(id)) secrets.delete(id)
  })
  let closed = false
  queue.on('finished', (job) => {
    if (!closed) store.record(job)
  })

  let statusCache: SystemInfo['tools'] | undefined

  const has = (c: Capability) => (c === 'print' ? Boolean(opts.host.printToPdf) : c === 'trash' ? Boolean(opts.host.trash) : Boolean(tools[c]))
  const missing = (caps: readonly Capability[]) => [...new Set(caps)].filter((c) => !has(c))

  const engine: Engine = {
    listOps: () =>
      allOps().map((op) => {
        const gone = missing(op.requires ?? [])
        return { ...describeOp(op), available: gone.length === 0, missing: gone }
      }),

    targetsFor: (paths) =>
      paths.map((p) => {
        const ext = path.extname(p).slice(1) || p
        const targets = allOps()
          .filter((op) => op.targets && op.accepts(ext))
          .flatMap((op) =>
            op.targets!(ext).map((t) => {
              const gone = missing([...(op.requires ?? []), ...(t.requires ?? [])])
              return { op: op.id, ext: t.ext, available: gone.length === 0, missing: gone }
            }),
          )
        return { path: p, targets }
      }),

    startOp(opId, raw) {
      const op = opById(opId)
      if (!op) throw new OpInputError('unknown_op', unknownOpError(opId), 'op')
      const { args, out } = parseOpInput(op, raw)
      const gone = missing([...(op.requires ?? []), ...(op.needs?.(args) ?? [])])
      if (gone.length) throw new OpInputError('unavailable', opUnavailableError(op.label, gone))
      const parts = splitInput(op, args)
      if (out && splitOut(out).file && (parts.length > 1 || parts.some((a) => op.many?.(a)))) throw new OpInputError('invalid_input', OUT_NEEDS_FOLDER, 'out')
      return parts.map((a) => {
        const id = randomUUID()
        const { kept, hidden } = splitSecrets(op, a)
        // Set before add: the queue may start the job inside add().
        if (hidden) secrets.set(id, hidden)
        return queue.add({
          ...jobFields(op, kept, settings),
          id,
          kind: op.kind,
          op: op.id,
          args: out ? { ...kept, out } : kept,
          restartsOnResume: !op.resumable,
        })
      })
    },

    async runOp(opId, raw, { signal, timeoutMs } = {}) {
      if (signal?.aborted) throw new CanceledError()
      const ids = engine.startOp(opId, raw).map((j) => j.id)
      const cancel = () => ids.forEach((id) => queue.cancel(id))
      signal?.addEventListener('abort', cancel, { once: true })
      let timer: NodeJS.Timeout | undefined
      try {
        const settled = Promise.all(ids.map((id) => queue.whenSettled(id)))
        const gaveUp = new Promise<undefined>((r) => {
          if (timeoutMs !== undefined) timer = setTimeout(() => r(undefined), timeoutMs)
        })
        const jobs = (await Promise.race([settled, gaveUp])) ?? ids.map((id) => engine.getJob(id))
        return jobs.filter((j): j is Job => j !== undefined)
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
      }
    },

    getJob: (id) => {
      const j = queue.get(id)
      return j && { ...j }
    },
    listJobs: () => queue.list(),
    cancelJob: (id) => queue.cancel(id),
    pause: (id) => queue.pause(id),
    resume: (id) => queue.resume(id),
    retry: (id) => queue.retry(id),
    remove: (id) => queue.remove(id),
    reorder: (ids) => queue.reorder(ids),
    pauseAll: () => queue.pauseAll(),
    resumeAll: () => queue.resumeAll(),
    clearFinished: () => queue.clearFinished(),
    // Node's typed emitter can't resolve its listener type for a generic event name.
    on: (event, listener) => void queue.on(event, listener as never),
    off: (event, listener) => void queue.off(event, listener as never),

    startConvert: (paths, convert) => (paths.length ? engine.startOp('convert', convertArgs(paths, convert)) : []),

    startDownload: (req) => engine.startOp('download', downloadArgs(req))[0]!,

    history: (q) => store.search(q),

    rerun(id) {
      const h = store.get(id)
      if (h?.args === undefined) return []
      const op = opById(h.op)
      if (op?.secret?.length && (h.args as Record<string, unknown>)[SECRET_GIVEN] === true) throw new OpInputError('invalid_input', secretNotKeptError(op.label), op.secret[0])
      return engine.startOp(h.op, h.args)
    },

    removeHistory: (id) => store.remove(id),
    clearHistory: () => store.clear(),

    getSettings: () => settings,

    setSettings(patch) {
      store.saveSettings(patch)
      settings = store.loadSettings(opts.defaultRoot)
      queue.setConcurrency(atOnce(settings))
      return settings
    },

    async systemInfo() {
      statusCache ??= await toolStatuses(tools)
      return {
        appVersion: opts.appVersion,
        platform: process.platform,
        cores: env.cores,
        gpu: { encoders: gpu.encoders },
        gpuLabel: gpu.label,
        tools: statusCache,
      }
    },

    probe: (paths) => probeFiles(env, paths),

    inspect: (url) => inspectLink(env, url),

    async updateYtDlp() {
      const res = await updateYtDlp(env)
      statusCache = undefined
      return res
    },

    async shutdown() {
      await queue.shutdown()
      closed = true
      store.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
  return engine
}

export type { EngineEnv, EngineHost } from './convert'
export { convertFile, probeFiles } from './convert'
export { downloadLink, inspectLink } from './download'
export * from './ops'
export { opContext, parseOpInput, runOpJob, splitInput } from './ops/run'
export { planOutput, splitOut, type OutputPlan, type OutputRequest, type OutTarget } from './output'
export { CanceledError, run, runOk } from './process'
export { JobQueue, type NewJob, type RunContext, type Runner } from './queue'
export { Store } from './store'
export { locateTools, type ToolId, type Tools } from './tools'
