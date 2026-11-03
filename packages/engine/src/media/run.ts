// What the media ops share: probing, running one FFmpeg pass with progress, picking the encoder the way convert does, and saving.
import {
  buildFfmpegPlan,
  categoryOf,
  createFfmpegProgressParser,
  explainFfmpegError,
  explainFileError,
  formatInfo,
  FORMATS,
  MEDIA_TEXT,
  normalizeExt,
  NO_GPU,
  opUnavailableError,
  type CompressionLevel,
  type FfprobeInfo,
  type GpuInfo,
  type PerformanceLevel,
} from '@sparky/core'
import fs from 'node:fs/promises'
import { probe } from '../convert'
import type { OutputRequest } from '../output'
import { run, throwIfAborted, type RunResult } from '../process'
import type { OpContext, OpResult } from '../ops/types'
import { encoderSection, type EditSpec } from './filters'

export const MEDIA_OUTPUTS = FORMATS.filter((f) => (f.category === 'video' && f.ext !== 'gif') || f.category === 'audio').map((f) => f.ext) as [string, ...string[]]

export const isVideoOrAudio = (ext: string) => {
  const c = categoryOf(ext)
  return c === 'video' || c === 'audio'
}

export const isVideo = (ext: string) => categoryOf(ext) === 'video'

export const isVideoOutput = (ext: string) => formatInfo(ext)?.category === 'video'

export const hasPicture = (file: string, info: FfprobeInfo) => info.hasVideo && categoryOf(file) !== 'audio'

export function sameOrDefaultExt(file: string, picture: boolean): string {
  const ext = normalizeExt(file)
  if ((MEDIA_OUTPUTS as string[]).includes(ext) && isVideoOutput(ext) === picture) return ext
  return picture ? 'mp4' : 'mp3'
}

export function checkTrim(e: Pick<EditSpec, 'trimStart' | 'trimEnd'>, duration?: number): void {
  if (e.trimEnd !== undefined && e.trimEnd <= (e.trimStart ?? 0)) throw new Error(MEDIA_TEXT.trimBackwards)
  if (duration !== undefined && e.trimStart !== undefined && e.trimStart >= duration) throw new Error(MEDIA_TEXT.trimPastEnd)
}

export interface FileOutcome {
  output: string
  sizeBefore: number
  sizeAfter: number
  warnings?: (string | undefined)[]
}

export async function forEachFile(files: string[], one: (file: string) => Promise<FileOutcome>): Promise<OpResult> {
  const r: Required<OpResult> = { outputs: [], sizeBefore: 0, sizeAfter: 0, warnings: [] }
  for (const file of files) {
    const o = await one(file)
    r.outputs.push(o.output)
    r.sizeBefore += o.sizeBefore
    r.sizeAfter += o.sizeAfter
    for (const w of o.warnings ?? []) if (w && !r.warnings.includes(w)) r.warnings.push(w)
  }
  return r
}

export async function sourceSize(file: string): Promise<number> {
  const stat = await fs.stat(file).catch(() => undefined)
  if (!stat?.isFile()) throw new Error(MEDIA_TEXT.gone)
  return stat.size
}

export async function probeMedia(ctx: OpContext, file: string): Promise<FfprobeInfo> {
  return (await probe(ctx, file)) ?? { hasAudio: true, hasVideo: true }
}

export function ffmpegPath(ctx: OpContext): string {
  if (!ctx.tools.ffmpeg) throw new Error(opUnavailableError('', ['ffmpeg']))
  return ctx.tools.ffmpeg
}

export interface StepOptions {
  total?: number
  from?: number
  span?: number
  lowPriority: boolean
}

export async function ffmpegStep(ctx: OpContext, args: string[], o: StepOptions): Promise<RunResult> {
  const from = o.from ?? 0
  const span = o.span ?? 1
  const parse = createFfmpegProgressParser(o.total)
  ctx.progress({ fraction: o.total ? from : null })
  return run(ffmpegPath(ctx), args, {
    signal: ctx.signal,
    lowPriority: o.lowPriority,
    onStdout: (chunk) => {
      const u = parse(chunk)
      if (!u) return
      if (u.progress < 0) ctx.progress({ fraction: null, speed: u.speed })
      else ctx.progress({ fraction: from + u.progress * span, speed: u.speed, eta: span === 1 ? u.eta : undefined })
    },
  })
}

export async function ffmpegOk(ctx: OpContext, args: string[], o: StepOptions): Promise<void> {
  const res = await ffmpegStep(ctx, args, o)
  if (res.code !== 0) throw new Error(explainFfmpegError(res.stderr))
}

export interface EncoderChoice {
  encode: string[]
  encoder?: string
  usedGpu: boolean
  lowPriority: boolean
  note?: string
}

export interface EncoderRequest {
  input: string
  output: string
  ext: string
  compression: CompressionLevel
  performance: PerformanceLevel
  gpu: GpuInfo
  sourceHeight?: number
  videoKbps?: number
  audioKbps?: number
}

export function chooseEncoder(ctx: OpContext, r: EncoderRequest): EncoderChoice {
  const plan = buildFfmpegPlan({
    input: r.input,
    output: r.output,
    settings: {
      output: r.ext,
      compression: r.compression,
      resolution: null,
      performance: r.performance,
      originals: 'keep',
      advanced: { videoKbps: r.videoKbps, audioKbps: r.audioKbps },
    },
    defaultCodec: ctx.settings().codec,
    gpu: r.gpu,
    cores: ctx.cores,
    sourceHeight: r.sourceHeight,
  })
  return { encode: encoderSection(plan.args, r.input), encoder: plan.encoder, usedGpu: plan.usedGpu, lowPriority: plan.lowPriority, note: plan.notes[0] }
}

export async function withGpuFallback(
  ctx: OpContext,
  attempt: (gpu: GpuInfo) => Promise<{ usedGpu: boolean; stderr?: string; note?: string }>,
  cleanup: () => Promise<void>,
): Promise<string | undefined> {
  const first = await attempt(ctx.gpu)
  if (first.stderr === undefined) return first.note
  if (!first.usedGpu) throw new Error(explainFfmpegError(first.stderr))
  await cleanup()
  const second = await attempt(NO_GPU)
  if (second.stderr !== undefined) throw new Error(explainFfmpegError(second.stderr))
  return MEDIA_TEXT.gpuFallback
}

export interface Saved {
  path: string
  size: number
  keptOriginal: boolean
}

export async function saveOutput(
  ctx: OpContext,
  req: OutputRequest & { input: string },
  work: (tmpPath: string) => Promise<void>,
  keepOriginal?: (size: number) => boolean,
): Promise<Saved> {
  const plan = await ctx.output(req)
  const cleanup = () => fs.rm(plan.tmpPath, { recursive: true, force: true }).catch(() => undefined)
  try {
    await work(plan.tmpPath)
    throwIfAborted(ctx.signal)
    let size = (await fs.stat(plan.tmpPath)).size
    const keptOriginal = keepOriginal?.(size) ?? false
    if (keptOriginal) {
      if (!ctx.out) {
        await cleanup()
        return { path: req.input, size: (await fs.stat(req.input)).size, keptOriginal }
      }
      await fs.copyFile(req.input, plan.tmpPath)
      size = (await fs.stat(plan.tmpPath)).size
    }
    const finalPath = await plan.claimFinal()
    try {
      await plan.place(finalPath)
    } catch (e) {
      await plan.release()
      throw (e as NodeJS.ErrnoException).code ? new Error(explainFileError(e, 'save')) : e
    }
    return { path: finalPath, size, keptOriginal }
  } catch (e) {
    await cleanup()
    throw e
  }
}
