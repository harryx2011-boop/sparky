// Downloads with yt-dlp, then optionally converts the result in the same job.
import {
  explainYtDlpError,
  formatSpeed,
  inspectArgs,
  OUTPUT_FOLDERS,
  parseLinkInfo,
  parseYtDlpLine,
  planDownload,
  postprocessLabel,
  type Job,
  type LinkInfo,
} from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import { convertFile, type EngineEnv } from './convert'
import { run, throwIfAborted } from './process'
import type { RunContext } from './queue'
import { jsRuntimeArg } from './tools'

class DownloadError extends Error {
  constructor(
    message: string,
    public suggestUpdate: boolean,
  ) {
    super(message)
  }
}

function ytdlp(env: EngineEnv): string {
  if (!env.tools['yt-dlp']) throw new DownloadError('The downloader (yt-dlp) is missing. Reinstall Sparky to get it back.', false)
  return env.tools['yt-dlp']
}

export async function inspectLink(env: EngineEnv, url: string, signal?: AbortSignal): Promise<LinkInfo> {
  const res = await run(ytdlp(env), inspectArgs(url, jsRuntimeArg(env.tools)), { signal, timeoutMs: 90_000 })
  if (res.code !== 0 || !res.stdout.trim()) {
    const e = explainYtDlpError(res.stderr)
    throw new DownloadError(e.message, e.suggestUpdate)
  }
  return parseLinkInfo(res.stdout, url)
}

export async function updateYtDlp(env: EngineEnv): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await run(ytdlp(env), ['-U'], { timeoutMs: 120_000 })
    const text = (res.stdout + res.stderr).trim()
    if (res.code !== 0) return { ok: false, message: text.split(/\r?\n/).pop() ?? 'Update failed.' }
    if (/up to date/i.test(text)) return { ok: true, message: 'The downloader is already up to date.' }
    const version = /Updated yt-dlp to\s+(\S+)/i.exec(text)?.[1]
    return { ok: true, message: version ? `Updated the downloader to ${version}.` : 'The downloader was updated.' }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export async function runDownloadJob(env: EngineEnv, job: Job, ctx: RunContext): Promise<Partial<Job>> {
  const req = job.download
  if (!req) throw new Error('Download settings are missing.')
  const outputDir = path.join(env.settings().outputRoot, OUTPUT_FOLDERS.download)
  await fs.mkdir(outputDir, { recursive: true })

  const plan = planDownload(req, {
    outputDir,
    ffmpegDir: env.tools.ffmpeg ? path.dirname(env.tools.ffmpeg) : undefined,
    jsRuntime: jsRuntimeArg(env.tools),
  })
  const stages = plan.convertAfter ? 2 : 1
  const count = Math.max(1, req.count ?? req.items?.length ?? 1)
  const files: string[] = []
  let best = 0
  let item = 1

  ctx.update({ stage: { index: 1, count: stages, label: 'Downloading' }, progress: 0 })
  const res = await run(ytdlp(env), plan.args, {
    signal: ctx.signal,
    lowPriority: req.performance === 'low',
    onStdoutLine: (line) => {
      const ev = parseYtDlpLine(line)
      if (!ev) return
      if (ev.kind === 'file') {
        files.push(ev.path)
      } else if (ev.kind === 'postprocess') {
        if (ev.status === 'started') ctx.update({ stage: { index: 1, count: stages, label: postprocessLabel(ev.name) }, speed: undefined, eta: undefined })
      } else {
        if (ev.item && ev.item !== item) item = ev.item
        const part = ev.total ? Math.min(1, ev.downloaded / ev.total) : 0
        // Video and sound download separately, so keep the bar from jumping backwards.
        const overall = Math.min(0.999, (item - 1 + part) / count)
        best = Math.max(best, overall)
        ctx.update({
          progress: stages === 2 ? best / 2 : best,
          speed: formatSpeed(ev.speed),
          eta: ev.eta,
          stage: { index: 1, count: stages, label: count > 1 ? `Downloading ${Math.min(item, count)} of ${count}` : 'Downloading' },
        })
      }
    },
  })

  if (files.length === 0) {
    const e = explainYtDlpError(res.stderr)
    throw new DownloadError(res.code === 0 ? 'Nothing was downloaded. The items may be unavailable.' : e.message, e.suggestUpdate)
  }
  const failedItems = res.code !== 0 ? Math.max(0, count - files.length) : 0
  let note = failedItems > 0 ? `${failedItems} item${failedItems === 1 ? '' : 's'} couldn’t be downloaded.` : undefined

  let outputs = files
  let sizeAfter: number | undefined
  if (plan.convertAfter) {
    outputs = []
    sizeAfter = 0
    for (const [i, file] of files.entries()) {
      throwIfAborted(ctx.signal)
      ctx.update({ stage: { index: 2, count: 2, label: files.length > 1 ? `Converting ${i + 1} of ${files.length}` : 'Converting' }, speed: undefined, eta: undefined })
      const result = await convertFile(
        env,
        file,
        { output: plan.convertAfter, compression: req.compression, performance: req.performance, resolution: null, originals: 'keep', advanced: {} },
        {
          signal: ctx.signal,
          update: (p) => {
            const local = p.progress !== undefined && p.progress >= 0 ? p.progress : 0
            ctx.update({ ...p, progress: 0.5 + ((i + local) / files.length) * 0.5 })
          },
        },
        { outDir: path.dirname(file) },
      )
      // The downloaded copy was only a stepping stone.
      if (result.output !== file) await fs.rm(file, { force: true })
      outputs.push(result.output)
      sizeAfter += result.sizeAfter
      if (result.note) note = note ? `${note} ${result.note}` : result.note
    }
  }
  return { outputs, sizeAfter, note }
}
