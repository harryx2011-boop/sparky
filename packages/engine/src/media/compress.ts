// media.compress: a video or sound file made smaller, aimed at a size (Email, Discord, or MB) or at a quality (Web, Archive).
import { bitrateForTarget, formatInfo, MEDIA_TEXT, normalizeExt, PRESET_TARGETS, type CompressionLevel, type GpuInfo } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import { performanceField } from '../ops/fields'
import type { Op, OpContext } from '../ops/types'
import { audioBpsFor, audioOnlyBps, cappedRateArgs, plainArgs, targetBytes, TWO_PASS_ENCODERS, twoPassArgs, type CompressTarget } from './filters'
import {
  chooseEncoder,
  ffmpegStep,
  forEachFile,
  hasPicture,
  isVideoOrAudio,
  isVideoOutput,
  MEDIA_OUTPUTS,
  probeMedia,
  saveOutput,
  sourceSize,
  withGpuFallback,
  type EncoderChoice,
  type FileOutcome,
} from './run'

const F = MEDIA_TEXT.compress.fields

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  target: z.enum(Object.keys(PRESET_TARGETS) as [CompressTarget, ...CompressTarget[]]).meta(F.target).optional(),
  /** Wins over `target`. */
  targetMb: z.number().positive().meta(F.targetMb).optional(),
  output: z.enum(MEDIA_OUTPUTS).meta(F.output).optional(),
  performance: performanceField.meta(F.performance).optional(),
})

export type CompressArgs = z.infer<typeof input>

/** Compression level standing in for each quality-led preset: Archive keeps detail, Web trades a little. */
const QUALITY_LEVEL: Record<'web' | 'archive', CompressionLevel> = { web: 3, archive: 1 }

const mbText = (bytes: number) => String(Number((bytes / 1024 / 1024).toFixed(1)))

interface Attempt {
  usedGpu: boolean
  stderr?: string
  note?: string
}

async function compressOne(ctx: OpContext, file: string, a: CompressArgs): Promise<FileOutcome> {
  const sizeBefore = await sourceSize(file)
  const info = await probeMedia(ctx, file)
  const picture = hasPicture(file, info)
  const ext = a.output ?? (picture ? 'mp4' : 'mp3')
  const toVideo = isVideoOutput(ext)
  if (toVideo && !picture) throw new Error(MEDIA_TEXT.audioToVideo)
  if (!toVideo && !info.hasAudio) throw new Error(MEDIA_TEXT.noSound)
  const sameExt = normalizeExt(file) === ext
  const bytes = targetBytes(a.target, a.targetMb)
  const req = { input: file, ext, category: formatInfo(ext)!.category, suffix: MEDIA_TEXT.compress.suffix }
  if (bytes !== null && sameExt && sizeBefore <= bytes) {
    const warnings = [MEDIA_TEXT.alreadyUnder(mbText(bytes))]
    if (!ctx.out) return { output: file, sizeBefore, sizeAfter: sizeBefore, warnings }
    // The caller asked for a file at `out`, so the untouched original goes there.
    const copy = await saveOutput(ctx, req, (tmp) => fs.copyFile(file, tmp))
    return { output: copy.path, sizeBefore, sizeAfter: copy.size, warnings }
  }
  const duration = info.duration
  if (bytes !== null && duration === undefined) throw new Error(MEDIA_TEXT.sizeNeedsLength)

  const performance = a.performance ?? ctx.settings().performance
  const quality = bytes === null ? QUALITY_LEVEL[a.target === 'archive' ? 'archive' : 'web'] : 2
  let videoKbps: number | undefined
  let audioKbps: number | undefined
  if (bytes !== null) {
    if (toVideo) {
      const audioBps = info.hasAudio ? audioBpsFor(bytes, duration!) : 0
      const videoBps = bitrateForTarget(bytes, duration!, audioBps)
      if (videoBps === null) throw new Error(MEDIA_TEXT.sizeTooSmall(mbText(bytes)))
      videoKbps = Math.floor(videoBps / 1000)
      if (audioBps) audioKbps = audioBps / 1000
    } else {
      const bps = audioOnlyBps(bytes, duration!)
      if (bps === null) throw new Error(MEDIA_TEXT.sizeTooSmall(mbText(bytes)))
      audioKbps = Math.floor(bps / 1000)
    }
  }

  const warnings: (string | undefined)[] = []
  const work = path.join(ctx.tempDir, `compress-${randomUUID()}`)
  const saved = await saveOutput(
    ctx,
    req,
    async (tmp) => {
      const encoder = (gpu: GpuInfo): EncoderChoice =>
        chooseEncoder(ctx, { input: file, output: tmp, ext, compression: quality, performance, gpu, sourceHeight: info.height, videoKbps, audioKbps })
      const attempt = async (gpu: GpuInfo): Promise<Attempt> => {
        const enc = encoder(gpu)
        const step = { total: duration, lowPriority: enc.lowPriority }
        const done = (code: number | null, stderr: string): Attempt => ({ usedGpu: enc.usedGpu, stderr: code === 0 ? undefined : stderr, note: enc.note })
        if (videoKbps === undefined) {
          const r = await ffmpegStep(ctx, plainArgs(file, tmp, enc.encode), step)
          return done(r.code, r.stderr)
        }
        // A graphics card encoder can't take two passes here; a rate cap keeps it close to the size instead.
        if (enc.usedGpu || !TWO_PASS_ENCODERS.has(enc.encoder ?? '')) {
          const r = await ffmpegStep(ctx, cappedRateArgs(file, tmp, enc.encode, videoKbps), step)
          // Card encoders have a quality floor they won't go under, so a small size can come out far over; the processor's two passes land it.
          if (r.code === 0 && enc.usedGpu && bytes !== null && (await fs.stat(tmp)).size > bytes) return { usedGpu: true, stderr: '' }
          return done(r.code, r.stderr)
        }
        await fs.mkdir(work, { recursive: true })
        const passes = twoPassArgs(file, tmp, enc.encode, path.join(work, 'pass'))
        const first = await ffmpegStep(ctx, passes.first, { ...step, from: 0, span: 0.5 })
        if (first.code !== 0) return done(first.code, first.stderr)
        const second = await ffmpegStep(ctx, passes.second, { ...step, from: 0.5, span: 0.5 })
        return done(second.code, second.stderr)
      }
      try {
        warnings.push(await withGpuFallback(ctx, attempt, () => fs.rm(tmp, { force: true })))
      } finally {
        await fs.rm(work, { recursive: true, force: true })
      }
    },
    // A same-format copy that came out bigger isn't worth keeping.
    (size) => sameExt && size >= sizeBefore,
  )
  if (saved.keptOriginal) warnings.push(MEDIA_TEXT.alreadySmall)
  return { output: saved.path, sizeBefore, sizeAfter: saved.size, warnings }
}

export const compressOp: Op<typeof input> = {
  id: 'media.compress',
  label: MEDIA_TEXT.compress.label,
  doneLabel: MEDIA_TEXT.compress.done,
  category: 'video',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: isVideoOrAudio,
  requires: ['ffmpeg', 'ffprobe'],
  describe: (a) => ({ title: MEDIA_TEXT.compress.title(a.files[0] ?? '') }),
  run: (ctx, a) => forEachFile(a.files, (file) => compressOne(ctx, file, a)),
}
