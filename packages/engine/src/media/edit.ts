// media.edit: trim, crop, turn, flip, resize, frame rate, sound level, fades, reverse and speed in one FFmpeg pass.
import { formatInfo, MEDIA_TEXT, type CompressionLevel } from '@sparky/core'
import fs from 'node:fs/promises'
import { z } from 'zod/v4'
import { compressionField, performanceField } from '../ops/fields'
import type { Op, OpContext } from '../ops/types'
import { editArgs, editedLength, hasCrop, hasVideoEdits, type EditSpec } from './filters'
import {
  checkTrim,
  chooseEncoder,
  ffmpegStep,
  forEachFile,
  hasPicture,
  isVideoOrAudio,
  isVideoOutput,
  MEDIA_OUTPUTS,
  probeMedia,
  sameOrDefaultExt,
  saveOutput,
  sourceSize,
  withGpuFallback,
  type FileOutcome,
} from './run'

const F = MEDIA_TEXT.edit.fields
const pixels = z.number().int().positive()

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  output: z.enum(MEDIA_OUTPUTS).meta(F.output).optional(),
  trimStart: z.number().min(0).meta(F.trimStart).optional(),
  trimEnd: z.number().positive().meta(F.trimEnd).optional(),
  cropX: z.number().int().min(0).meta(F.cropX).optional(),
  cropY: z.number().int().min(0).meta(F.cropY).optional(),
  cropWidth: pixels.meta(F.cropWidth).optional(),
  cropHeight: pixels.meta(F.cropHeight).optional(),
  rotate: z.union([z.literal(90), z.literal(180), z.literal(270)]).meta(F.rotate).optional(),
  flip: z.enum(['h', 'v', 'hv']).meta(F.flip).optional(),
  width: pixels.meta(F.width).optional(),
  height: pixels.meta(F.height).optional(),
  fps: z.number().positive().meta(F.fps).optional(),
  stripAudio: z.boolean().default(false).meta(F.stripAudio),
  volume: z.number().min(0).meta(F.volume).optional(),
  fadeIn: z.number().positive().meta(F.fadeIn).optional(),
  fadeOut: z.number().positive().meta(F.fadeOut).optional(),
  reverse: z.boolean().default(false).meta(F.reverse),
  speed: z.number().positive().meta(F.speed).optional(),
  compression: compressionField.meta(F.compression).optional(),
  performance: performanceField.meta(F.performance).optional(),
})

export type EditArgs = z.infer<typeof input>

function checkCrop(e: EditSpec, width?: number, height?: number): void {
  if (!hasCrop(e) || width === undefined || height === undefined) return
  const right = (e.cropX ?? 0) + (e.cropWidth ?? 0)
  const bottom = (e.cropY ?? 0) + (e.cropHeight ?? 0)
  if (right > width || bottom > height || (e.cropX ?? 0) >= width || (e.cropY ?? 0) >= height) throw new Error(MEDIA_TEXT.cropOutside(width, height))
}

async function editOne(ctx: OpContext, file: string, a: EditArgs): Promise<FileOutcome> {
  const sizeBefore = await sourceSize(file)
  const info = await probeMedia(ctx, file)
  const picture = hasPicture(file, info)
  const ext = a.output ?? sameOrDefaultExt(file, picture)
  const toVideo = isVideoOutput(ext)
  if (toVideo && !picture) throw new Error(MEDIA_TEXT.audioToVideo)
  if (!toVideo && a.stripAudio) throw new Error(MEDIA_TEXT.nothingLeft)
  if (!toVideo && !info.hasAudio) throw new Error(MEDIA_TEXT.noSound)
  checkTrim(a, info.duration)
  if (toVideo) checkCrop(a, info.width, info.height)

  const warnings: (string | undefined)[] = []
  if (!toVideo && hasVideoEdits(a)) warnings.push(MEDIA_TEXT.videoOnlySkipped)
  const length = editedLength(a, info.duration)
  if (a.fadeOut && length === undefined) warnings.push(MEDIA_TEXT.fadeNeedsLength)

  const s = ctx.settings()
  const compression: CompressionLevel = a.compression ?? s.compression
  const performance = a.performance ?? s.performance
  const audio = info.hasAudio && !a.stripAudio

  const saved = await saveOutput(ctx, { input: file, ext, category: formatInfo(ext)!.category, suffix: MEDIA_TEXT.edit.suffix }, async (tmp) => {
    const note = await withGpuFallback(
      ctx,
      async (gpu) => {
        const enc = chooseEncoder(ctx, { input: file, output: tmp, ext, compression, performance, gpu, sourceHeight: info.height })
        const args = editArgs({ input: file, output: tmp, edit: a, encode: enc.encode, video: toVideo, audio, length })
        const res = await ffmpegStep(ctx, args, { total: length, lowPriority: enc.lowPriority })
        return { usedGpu: enc.usedGpu, stderr: res.code === 0 ? undefined : res.stderr, note: enc.note }
      },
      () => fs.rm(tmp, { force: true }),
    )
    warnings.push(note)
  })
  return { output: saved.path, sizeBefore, sizeAfter: saved.size, warnings }
}

export const editOp: Op<typeof input> = {
  id: 'media.edit',
  label: MEDIA_TEXT.edit.label,
  doneLabel: MEDIA_TEXT.edit.done,
  category: 'video',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: isVideoOrAudio,
  requires: ['ffmpeg', 'ffprobe'],
  describe: (a) => ({ title: MEDIA_TEXT.edit.title(a.files[0] ?? '') }),
  run: (ctx, a) => forEachFile(a.files, (file) => editOne(ctx, file, a)),
}
