// convert: one file into another format, or the same format made smaller.
import {
  categoryOf,
  convertTitle,
  engineFor,
  isSupportedInput,
  normalizeExt,
  OP_TEXT,
  outputsFor,
  type AdvancedOptions,
  type ConvertSettings,
  type Engine as Converter,
  type Settings,
} from '@sparky/core'
import { z } from 'zod/v4'
import { convertFile } from '../convert'
import { compressionField, defined, heights, legacyRun, performanceField } from './fields'
import type { Capability, Op } from './types'

const input = z.object({
  files: z.array(z.string().min(1)).min(1),
  /** Target extension; the input's own extension means "just make it smaller". */
  output: z.string().min(1),
  compression: compressionField.optional(),
  resolution: z.union([z.literal('source'), ...heights]).optional(),
  performance: performanceField.optional(),
  originals: z.enum(['keep', 'replace', 'trash']).optional(),
  codec: z.enum(['h264', 'hevc', 'av1']).optional(),
  videoKbps: z.number().positive().optional(),
  audioKbps: z.number().positive().optional(),
  imageQuality: z.number().positive().max(100).optional(),
  trimStart: z.number().min(0).optional(),
  trimEnd: z.number().min(0).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fps: z.number().positive().optional(),
})

export type ConvertArgs = z.infer<typeof input>

/** The app's ConvertSettings as this op's flat input. */
export function convertArgs(files: string[], s: ConvertSettings): ConvertArgs {
  const { advanced, resolution, ...rest } = s
  return { files, ...rest, resolution: resolution ?? 'source', ...defined(advanced) }
}

/** The flat input back as ConvertSettings; what the caller left out comes from Settings. */
function toSettings(a: ConvertArgs, s: Settings): ConvertSettings {
  const { codec, videoKbps, audioKbps, imageQuality, trimStart, trimEnd, width, height, fps } = a
  const advanced: AdvancedOptions = defined({ codec, videoKbps, audioKbps, imageQuality, trimStart, trimEnd, width, height, fps })
  return {
    output: a.output,
    compression: a.compression ?? s.compression,
    resolution: a.resolution === undefined || a.resolution === 'source' ? null : a.resolution,
    performance: a.performance ?? s.performance,
    originals: a.originals ?? 'keep',
    advanced,
  }
}

const NEEDS: Record<Converter, Capability[]> = {
  ffmpeg: ['ffmpeg'],
  sharp: [],
  pandoc: ['pandoc'],
  'pdf-print': ['print'],
  libreoffice: ['libreoffice'],
  ghostscript: ['ghostscript'],
  'pdf-text': [],
  '7zip': ['7zip'],
  document: [],
}

function targetNeeds(from: string, to: string): Capability[] {
  const via = engineFor(from, to) ?? engineFor(from, to, { libreoffice: true })
  if (!via) return []
  // Anything but HTML goes through Pandoc on its way to the printer.
  return via === 'pdf-print' && normalizeExt(from) !== 'html' ? ['pandoc', 'print'] : NEEDS[via]
}

export const convertOp: Op<typeof input> = {
  id: 'convert',
  label: OP_TEXT.convert.label,
  doneLabel: OP_TEXT.convert.done,
  category: 'convert',
  kind: 'convert',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input,
  accepts: (ext) => isSupportedInput(ext),
  targets: (ext) => outputsFor(ext).map((f) => ({ ext: f.ext, requires: targetNeeds(ext, f.ext) })),
  // Only what the app lends is checked up front; a missing tool fails the job with the fix in plain words.
  needs(a) {
    const host = new Set<Capability>()
    if (a.originals === 'trash' || a.originals === 'replace') host.add('trash')
    if (a.files.some((f) => targetNeeds(f, a.output).includes('print'))) host.add('print')
    return [...host]
  },
  describe(a, s) {
    const file = a.files[0] ?? ''
    return { title: convertTitle(file, a.output), source: file, category: categoryOf(file), convert: toSettings(a, s) }
  },
  fromHistory: (h) => (h.convert ? convertArgs([h.source], h.convert) : undefined),
  async run(ctx, a) {
    const settings = toSettings(a, ctx.settings())
    const outputs: string[] = []
    const warnings: string[] = []
    let sizeBefore = 0
    let sizeAfter = 0
    for (const file of a.files) {
      const r = await convertFile(ctx, file, settings, legacyRun(ctx), { out: ctx.out })
      outputs.push(r.output)
      sizeBefore += r.sizeBefore
      sizeAfter += r.sizeAfter
      if (r.note) warnings.push(r.note)
    }
    return { outputs, sizeBefore, sizeAfter, warnings }
  },
}
