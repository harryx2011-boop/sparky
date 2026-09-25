// image ops: edit (resize, rotate, flip, re-encode), Windows icons, and pictures into an animated GIF.
import { IMAGE_TEXT, normalizeExt } from '@sparky/core'
import { z } from 'zod/v4'
import { throwIfAborted } from '../process'
import { editImage, type EditExt } from '../image/edit'
import { makeGif } from '../image/gif'
import { DEFAULT_ICO_SIZES, makeIcon } from '../image/icon'
import { checkImage, readsWithSharp } from '../image/read'
import { saveResult } from '../image/save'
import type { Op } from './types'

const EDIT_OUT = ['png', 'jpg', 'webp', 'avif', 'tiff', 'bmp', 'gif'] as const
const px = z.number().int().positive()

const files = z.array(z.string().min(1)).min(1)
const E = IMAGE_TEXT.edit.fields

const editInput = z.object({
  files: files.meta(E.files),
  width: px.optional().meta(E.width),
  height: px.optional().meta(E.height),
  percent: z.number().positive().optional().meta(E.percent),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional().meta(E.fit),
  rotate: z.union([z.literal(90), z.literal(180), z.literal(270)]).optional().meta(E.rotate),
  flip: z.enum(['h', 'v', 'hv']).optional().meta(E.flip),
  stripMetadata: z.boolean().default(false).meta(E.stripMetadata),
  quality: z.number().int().min(1).max(100).optional().meta(E.quality),
  lossless: z.boolean().default(false).meta(E.lossless),
  background: z
    .string()
    .regex(/^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional()
    .meta(E.background),
  output: z.enum(EDIT_OUT).optional().meta(E.output),
})

const sameFormat = (file: string): EditExt => {
  const ext = normalizeExt(file)
  return (EDIT_OUT as readonly string[]).includes(ext) ? (ext as EditExt) : 'png'
}

export const imageEditOp: Op<typeof editInput> = {
  id: 'image.edit',
  label: IMAGE_TEXT.edit.label,
  doneLabel: IMAGE_TEXT.edit.done,
  category: 'image',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input: editInput,
  accepts: readsWithSharp,
  many: (a) => a.files.length > 1,
  describe(a) {
    const file = a.files[0] ?? ''
    return { title: IMAGE_TEXT.edit.title(file, a.output ?? sameFormat(file)), source: file, category: 'image' }
  },
  async run(ctx, a) {
    const outputs: string[] = []
    const warnings: string[] = []
    for (const [i, file] of a.files.entries()) {
      throwIfAborted(ctx.signal)
      await checkImage(file)
      const ext = a.output ?? sameFormat(file)
      ctx.progress({ fraction: a.files.length > 1 ? i / a.files.length : null })
      outputs.push(
        await saveResult(ctx, { input: file, ext, category: 'image' }, async (tmp) => {
          const note = await editImage(file, tmp, { ...a, output: ext })
          if (note) warnings.push(note)
        }),
      )
    }
    return { outputs, warnings: [...new Set(warnings)] }
  },
}

const I = IMAGE_TEXT.ico.fields

const icoInput = z.object({
  files: files.meta(I.files),
  sizes: z.array(px.max(256, IMAGE_TEXT.icoEdge)).min(1).optional().meta(I.sizes),
})

export const imageIcoOp: Op<typeof icoInput> = {
  id: 'image.ico',
  label: IMAGE_TEXT.ico.label,
  doneLabel: IMAGE_TEXT.ico.done,
  category: 'image',
  kind: 'tool',
  arity: 'each',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input: icoInput,
  accepts: readsWithSharp,
  many: (a) => a.files.length > 1,
  describe(a) {
    const file = a.files[0] ?? ''
    return { title: IMAGE_TEXT.ico.title(file), source: file, category: 'image' }
  },
  async run(ctx, a) {
    const outputs: string[] = []
    for (const file of a.files) {
      throwIfAborted(ctx.signal)
      await checkImage(file)
      ctx.progress({ fraction: null })
      outputs.push(await saveResult(ctx, { input: file, ext: 'ico', category: 'image' }, (tmp) => makeIcon(file, tmp, a.sizes ?? DEFAULT_ICO_SIZES, ctx.signal)))
    }
    return { outputs }
  },
}

const G = IMAGE_TEXT.gif.fields

const gifInput = z.object({
  files: files.meta(G.files),
  // GIF stores each frame's time in 16 bits; sharp takes it in milliseconds.
  delayMs: z.number().int().min(0).max(65535).optional().meta(G.delayMs),
  loop: z.boolean().default(true).meta(G.loop),
  width: px.optional().meta(G.width),
})

export const imageGifOp: Op<typeof gifInput> = {
  id: 'image.gif',
  label: IMAGE_TEXT.gif.label,
  doneLabel: IMAGE_TEXT.gif.done,
  category: 'image',
  kind: 'tool',
  arity: 'all',
  positional: ['files'],
  paths: ['files'],
  resumable: false,
  input: gifInput,
  accepts: readsWithSharp,
  describe(a) {
    const file = a.files[0] ?? ''
    return { title: IMAGE_TEXT.gif.title(file, a.files.length), source: file, category: 'image' }
  },
  async run(ctx, a) {
    for (const file of a.files) await checkImage(file)
    ctx.progress({ fraction: 0 })
    const first = a.files[0]!
    const output = await saveResult(ctx, { input: first, ext: 'gif', category: 'image' }, (tmp) =>
      makeGif(a.files, tmp, { delayMs: a.delayMs ?? 500, loop: a.loop, width: a.width }, ctx.signal, (fraction) => ctx.progress({ fraction })),
    )
    return { outputs: [output] }
  },
}

export const imageOps: readonly Op[] = [imageEditOp, imageIcoOp, imageGifOp]
