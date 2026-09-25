// download: a link (or a playlist) through yt-dlp, optionally converted in the same job.
import { downloadTitle, OP_TEXT, OUT_FILE_BECAME_FOLDER, type DownloadRequest, type Settings } from '@sparky/core'
import fs from 'node:fs/promises'
import { z } from 'zod/v4'
import { downloadLink } from '../download'
import { splitOut } from '../output'
import { compressionField, defined, heights, legacyRun, performanceField } from './fields'
import type { Op } from './types'

const input = z.object({
  urls: z.array(z.string().min(1)).min(1),
  /** Title shown in the queue. */
  title: z.string().optional(),
  mode: z.enum(['video', 'audio']).optional(),
  quality: z.union([z.literal('best'), ...heights]).optional(),
  /** 1-based playlist positions; left out downloads everything. */
  items: z.array(z.number().int().positive()).optional(),
  /** How many items this will download, for overall progress. */
  count: z.number().int().positive().optional(),
  convertTo: z.string().min(1).optional(),
  compression: compressionField.optional(),
  performance: performanceField.optional(),
  thumbnail: z.boolean().optional(),
  subtitles: z.enum(['off', 'download', 'embed']).optional(),
  subtitleLangs: z.array(z.string().min(1)).optional(),
  metadata: z.boolean().optional(),
  sponsorBlock: z.boolean().optional(),
})

export type DownloadArgs = z.infer<typeof input>

/** The app's DownloadRequest as this op's flat input. */
export function downloadArgs(req: DownloadRequest): DownloadArgs {
  const { url, extras, quality, convertTo, ...rest } = req
  return { urls: [url], ...defined(rest), quality: quality ?? 'best', ...(convertTo ? { convertTo } : {}), ...defined(extras) }
}

/** One link's request; what the caller left out comes from Settings. */
function toRequest(a: DownloadArgs, url: string, s: Settings): DownloadRequest {
  const { thumbnail, subtitles, subtitleLangs, metadata, sponsorBlock } = a
  return {
    url,
    title: a.title,
    mode: a.mode ?? s.downloadMode,
    quality: a.quality === undefined || a.quality === 'best' ? null : a.quality,
    items: a.items,
    count: a.count,
    convertTo: a.convertTo ?? null,
    compression: a.compression ?? s.compression,
    performance: a.performance ?? s.performance,
    extras: { ...s.downloadExtras, ...defined({ thumbnail, subtitles, subtitleLangs, metadata, sponsorBlock }) },
  }
}

export const downloadOp: Op<typeof input> = {
  id: 'download',
  label: OP_TEXT.download.label,
  doneLabel: OP_TEXT.download.done,
  category: 'download',
  kind: 'download',
  arity: 'each',
  positional: ['urls'],
  resumable: true,
  input,
  // Takes links, not files.
  accepts: () => false,
  requires: ['yt-dlp'],
  many: (a) => a.urls.length > 1 || (a.count ?? a.items?.length ?? 1) > 1,
  describe(a, s) {
    const req = toRequest(a, a.urls[0] ?? '', s)
    return { title: downloadTitle(req), source: req.url, category: 'download', download: req }
  },
  fromHistory: (h) => (h.download ? downloadArgs(h.download) : undefined),
  async run(ctx, a) {
    const target = ctx.out ? splitOut(ctx.out) : undefined
    const outputs: string[] = []
    const warnings: string[] = []
    let sizeAfter: number | undefined
    for (const url of a.urls) {
      const r = await downloadLink(ctx, toRequest(a, url, ctx.settings()), legacyRun(ctx), target?.dir)
      outputs.push(...r.outputs)
      if (r.sizeAfter !== undefined) sizeAfter = (sizeAfter ?? 0) + r.sizeAfter
      if (r.note) warnings.push(r.note)
    }
    const only = outputs[0]
    if (target?.file && only && outputs.length === 1) {
      await fs.rename(only, target.file)
      outputs[0] = target.file
    } else if (target?.file && outputs.length > 1) warnings.push(OUT_FILE_BECAME_FOLDER)
    return { outputs, sizeAfter, warnings }
  },
}
