// media.thumbs: a poster frame, a sheet of evenly spaced frames, or a short looping preview.
import { MEDIA_TEXT, thumbsArgs, type ThumbsOptions } from '@sparky/core'
import { z } from 'zod/v4'
import { performanceField } from '../ops/fields'
import type { Op, OpContext } from '../ops/types'
import { ffmpegOk, forEachFile, hasPicture, isVideo, probeMedia, saveOutput, sourceSize, type FileOutcome } from './run'

const F = MEDIA_TEXT.thumbs.fields

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  mode: z.enum(['poster', 'sprite', 'preview']).meta(F.mode).optional(),
  at: z.number().min(0).meta(F.at).optional(),
  count: z.number().int().positive().meta(F.count).optional(),
  columns: z.number().int().positive().meta(F.columns).optional(),
  width: z.number().int().min(16).meta(F.width).optional(),
  durationSec: z.number().positive().meta(F.durationSec).optional(),
  fps: z.number().positive().meta(F.fps).optional(),
  performance: performanceField.meta(F.performance).optional(),
})

export type ThumbsArgs = z.infer<typeof input>

const round = (n: number) => Number(n.toFixed(3))

/** The options thumbsArgs takes, with the defaults filled in from what the probe found. */
export function thumbsOptions(a: Omit<ThumbsArgs, 'files' | 'performance'>, info: { duration?: number; width?: number }): ThumbsOptions {
  const mode = a.mode ?? 'poster'
  const dur = info.duration
  // Past the end there is no frame to take; the last half second always has one.
  const start = a.at ?? (dur ? dur * 0.1 : 0)
  const at = round(dur ? Math.min(start, Math.max(0, dur - 0.5)) : start)
  if (mode === 'poster') return { mode, width: a.width ?? info.width ?? 1280, at }
  if (mode === 'sprite') {
    const count = a.count ?? 25
    return { mode, width: a.width ?? 160, count, columns: a.columns ?? Math.min(5, count) }
  }
  return { mode, width: a.width ?? Math.min(480, info.width ?? 480), at, durationSec: a.durationSec ?? 3, fps: a.fps ?? 10 }
}

async function thumbsOne(ctx: OpContext, file: string, a: ThumbsArgs): Promise<FileOutcome> {
  const sizeBefore = await sourceSize(file)
  const info = await probeMedia(ctx, file)
  if (!hasPicture(file, info)) throw new Error(MEDIA_TEXT.noPicture)
  const o = thumbsOptions(a, info)
  const ext = o.mode === 'preview' ? 'webp' : 'png'
  const lowPriority = (a.performance ?? ctx.settings().performance) === 'low'
  // A poster is one frame, so there is nothing to measure; a sheet reads the whole video; a preview only its stretch.
  const total = o.mode === 'sprite' ? info.duration : o.mode === 'preview' ? Math.min(o.durationSec!, (info.duration ?? Infinity) - (o.at ?? 0)) : undefined
  const saved = await saveOutput(ctx, { input: file, ext, category: 'image', suffix: MEDIA_TEXT.thumbs.suffix[o.mode] }, (tmp) =>
    ffmpegOk(ctx, thumbsArgs(file, tmp, o, info.duration ?? 0), { total, lowPriority }),
  )
  return { output: saved.path, sizeBefore, sizeAfter: saved.size }
}

export const thumbsOp: Op<typeof input> = {
  id: 'media.thumbs',
  label: MEDIA_TEXT.thumbs.label,
  doneLabel: MEDIA_TEXT.thumbs.done,
  category: 'video',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: isVideo,
  requires: ['ffmpeg', 'ffprobe'],
  describe: (a) => ({ title: MEDIA_TEXT.thumbs.title(a.files[0] ?? '') }),
  run: (ctx, a) => forEachFile(a.files, (file) => thumbsOne(ctx, file, a)),
}
