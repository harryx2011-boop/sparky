// media.gif: a video as a GIF, through a palette made from the clip itself so colours don't band.
import { gifArgs, MEDIA_TEXT, type GifOptions } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod/v4'
import { performanceField } from '../ops/fields'
import type { Op, OpContext } from '../ops/types'
import { editedLength } from './filters'
import { checkTrim, ffmpegOk, forEachFile, hasPicture, isVideo, probeMedia, saveOutput, sourceSize, type FileOutcome } from './run'

const F = MEDIA_TEXT.gif.fields

const input = z.object({
  files: z.array(z.string().min(1)).min(1).meta(F.files),
  // GIF frame timing is in hundredths of a second, and players slow anything faster than 50 a second right down.
  fps: z.number().positive().max(50).meta(F.fps).optional(),
  width: z.number().int().min(16).meta(F.width).optional(),
  loop: z.boolean().default(true).meta(F.loop),
  dither: z.enum(['none', 'bayer', 'floyd_steinberg', 'sierra2_4a']).meta(F.dither).optional(),
  trimStart: z.number().min(0).meta(F.trimStart).optional(),
  trimEnd: z.number().positive().meta(F.trimEnd).optional(),
  performance: performanceField.meta(F.performance).optional(),
})

export type GifArgs = z.infer<typeof input>

export function gifOptions(a: Omit<z.input<typeof input>, 'files' | 'performance'>, sourceWidth?: number): GifOptions {
  const trimmed = a.trimStart !== undefined || a.trimEnd !== undefined
  return {
    fps: a.fps ?? 12,
    width: a.width ?? Math.min(480, sourceWidth ?? 480),
    loop: a.loop ?? true,
    dither: a.dither ?? 'sierra2_4a',
    ...(trimmed ? { trim: { start: a.trimStart ?? 0, end: a.trimEnd ?? Infinity } } : {}),
  }
}

async function gifOne(ctx: OpContext, file: string, a: GifArgs): Promise<FileOutcome> {
  const sizeBefore = await sourceSize(file)
  const info = await probeMedia(ctx, file)
  if (!hasPicture(file, info)) throw new Error(MEDIA_TEXT.noPicture)
  checkTrim(a, info.duration)
  const total = editedLength(a, info.duration)
  const lowPriority = (a.performance ?? ctx.settings().performance) === 'low'
  const palette = path.join(ctx.tempDir, `palette-${randomUUID()}.png`)
  const args = gifArgs(file, palette, gifOptions(a, info.width))
  try {
    const saved = await saveOutput(ctx, { input: file, ext: 'gif', category: 'video' }, async (tmp) => {
      await ffmpegOk(ctx, args.palette, { total, from: 0, span: 0.3, lowPriority })
      await ffmpegOk(ctx, args.render(palette, tmp), { total, from: 0.3, span: 0.7, lowPriority })
    })
    return { output: saved.path, sizeBefore, sizeAfter: saved.size }
  } finally {
    await fs.rm(palette, { force: true })
  }
}

export const gifOp: Op<typeof input> = {
  id: 'media.gif',
  label: MEDIA_TEXT.gif.label,
  doneLabel: MEDIA_TEXT.gif.done,
  category: 'video',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: isVideo,
  requires: ['ffmpeg', 'ffprobe'],
  describe: (a) => ({ title: MEDIA_TEXT.gif.title(a.files[0] ?? '') }),
  run: (ctx, a) => forEachFile(a.files, (file) => gifOne(ctx, file, a)),
}
