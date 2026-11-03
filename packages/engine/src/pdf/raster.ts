// Draws PDF pages to PNG with pdf.js and @napi-rs/canvas. Shared by pdf.to_images and OCR.
import { explainFfmpegError, parsePageRanges } from '@sparky/core'
import { createRequire } from 'node:module'
import path from 'node:path'
import { throwIfAborted } from '../process'
import { breathe } from './deliver'
import { readBytes } from './document'

export interface RenderOptions {
  dpi: number
  pages?: string | readonly number[]
}

export interface RenderedPage {
  page: number
  total: number
  index: number
  count: number
  width: number
  height: number
  png: Buffer
}

let assets: { standardFontDataUrl: string; cMapUrl: string; wasmUrl: string; iccUrl: string } | undefined

function pdfjsAssets() {
  if (!assets) {
    const root = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
    const dir = (name: string) => `${path.join(root, name).split(path.sep).join('/')}/`
    assets = { standardFontDataUrl: dir('standard_fonts'), cMapUrl: dir('cmaps'), wasmUrl: dir('wasm'), iccUrl: dir('iccs') }
  }
  return assets
}

export async function* renderPdfPages(
  file: string,
  opts: RenderOptions,
  signal?: AbortSignal,
  onPage?: (done: number, count: number) => void,
): AsyncGenerator<RenderedPage> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = await import('@napi-rs/canvas')
  const data = await readBytes(file)
  const task = pdfjs.getDocument({ data, ...pdfjsAssets(), cMapPacked: true, useSystemFonts: true, verbosity: 0 })
  try {
    const doc = await task.promise.catch((e: Error) => {
      throw new Error(explainFfmpegError(`${e.name} ${e.message} Invalid PDF`))
    })
    const total = doc.numPages
    const pages = typeof opts.pages === 'string' || opts.pages === undefined ? parsePageRanges(opts.pages ?? '', total) : [...opts.pages]
    const scale = opts.dpi / 72
    for (const [index, page] of pages.entries()) {
      await breathe()
      throwIfAborted(signal)
      const p = await doc.getPage(page)
      const viewport = p.getViewport({ scale })
      const width = Math.max(1, Math.round(viewport.width))
      const height = Math.max(1, Math.round(viewport.height))
      const canvas = createCanvas(width, height)
      const render = p.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, background: '#ffffff' })
      const stop = () => render.cancel()
      signal?.addEventListener('abort', stop, { once: true })
      try {
        await render.promise
      } catch (e) {
        throwIfAborted(signal)
        throw e
      } finally {
        signal?.removeEventListener('abort', stop)
      }
      const png = await canvas.encode('png')
      p.cleanup()
      onPage?.(index + 1, pages.length)
      yield { page, total, index, count: pages.length, width, height, png }
    }
  } finally {
    await task.destroy()
  }
}
