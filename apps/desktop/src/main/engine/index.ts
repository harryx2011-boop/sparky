// The engine as one object: queue, tools, history and settings. Knows nothing about Electron.
import {
  categoryOf,
  normalizeExt,
  type ConvertSettings,
  type DownloadRequest,
  type HistoryQuery,
  type Job,
  type Settings,
  type SystemInfo,
} from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { probeFiles, runConvertJob, type EngineEnv, type EngineHost } from './convert'
import { inspectLink, runDownloadJob, updateYtDlp } from './download'
import { JobQueue } from './queue'
import { Store } from './store'
import { detectGpu, locateTools, toolStatuses } from './tools'

export interface EngineOptions {
  /** Folders searched for bundled tools, most preferred first. */
  binDirs: string[]
  /** Where the SQLite file lives. */
  dataDir: string
  tempDir: string
  /** Default output root, e.g. Documents\Sparky. */
  defaultRoot: string
  appVersion: string
  host: EngineHost
  /** Skip the graphics card test (used by tests). */
  skipGpu?: boolean
}

export type Engine = Awaited<ReturnType<typeof createEngine>>

export async function createEngine(opts: EngineOptions) {
  fs.mkdirSync(opts.dataDir, { recursive: true })
  fs.mkdirSync(opts.tempDir, { recursive: true })
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
    tempDir: opts.tempDir,
  }

  const queue = new JobQueue((job, ctx) => (job.kind === 'download' ? runDownloadJob(env, job, ctx) : runConvertJob(env, job, ctx)), settings.concurrency)
  queue.on('finished', (job) => store.record(job))

  let statusCache: SystemInfo['tools'] | undefined

  const engine = {
    queue,
    store,
    env,

    async systemInfo(): Promise<SystemInfo> {
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

    getSettings: (): Settings => settings,

    setSettings(patch: Partial<Settings>): Settings {
      store.saveSettings(patch)
      settings = store.loadSettings(opts.defaultRoot)
      queue.setConcurrency(settings.concurrency)
      return settings
    },

    probe: (paths: string[]) => probeFiles(env, paths),

    startConvert(paths: string[], convert: ConvertSettings): Job[] {
      return paths.map((p) =>
        queue.add({
          kind: 'convert',
          title: `${path.basename(p)} → ${normalizeExt(convert.output) === 'folder' ? 'Folder' : normalizeExt(convert.output).toUpperCase()}`,
          source: p,
          category: categoryOf(p),
          convert: structuredClone(convert),
        }),
      )
    },

    inspect: (url: string) => inspectLink(env, url),

    startDownload(req: DownloadRequest): Job {
      const target = req.convertTo ? ` → ${req.convertTo.toUpperCase()}` : req.mode === 'audio' ? ' → MP3' : ''
      return queue.add({ kind: 'download', title: `${req.title ?? req.url}${target}`, source: req.url, category: 'download', download: structuredClone(req) })
    },

    rerun(id: string): Job[] {
      const h = store.get(id)
      if (!h) return []
      if (h.kind === 'download' && h.download) return [engine.startDownload(h.download)]
      if (h.convert) return engine.startConvert([h.source], h.convert)
      return []
    },

    history: (q: HistoryQuery) => store.search(q),

    async updateYtDlp() {
      const res = await updateYtDlp(env)
      statusCache = undefined
      return res
    },

    shutdown(): void {
      queue.shutdown()
      store.close()
    },
  }
  return engine
}
