// Which pictures sharp can open, and a plain-language error when it can't.
import { IMAGE_TEXT, normalizeExt } from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'

/** What sharp's bundled libvips decodes. HEIC, BMP and ICO need other routes. */
export const SHARP_READS: ReadonlySet<string> = new Set(['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'])

export const readsWithSharp = (ext: string) => SHARP_READS.has(normalizeExt(ext))

/** Throws in plain words when the file is missing or isn't a picture sharp opens. */
export async function checkImage(file: string): Promise<void> {
  const stat = await fs.stat(file).catch(() => undefined)
  if (!stat?.isFile()) throw new Error(IMAGE_TEXT.gone)
  if (!readsWithSharp(file)) throw new Error(IMAGE_TEXT.notAnImage(path.basename(file)))
}

/**
 * The file's bytes, handed to sharp instead of its path: libvips keeps files it opened by path in its
 * cache, and on Windows that holds them open, so the user couldn't move or delete a source afterwards.
 */
export async function readBytes(file: string): Promise<Buffer> {
  return fs.readFile(file).catch(() => {
    throw new Error(IMAGE_TEXT.gone)
  })
}

/** sharp's own errors ("Input file contains unsupported image format") become one sentence a person can act on. */
export function explainSharpError(file: string, e: unknown): Error {
  const msg = (e as Error)?.message ?? ''
  if (/unsupported image format|corrupt|premature end|bad seek|not a known file format|VipsJpeg|pngload|webpload|gifload|tiffload|heifload/i.test(msg)) {
    return new Error(IMAGE_TEXT.damaged(path.basename(file)))
  }
  return e instanceof Error ? e : new Error(String(e))
}
