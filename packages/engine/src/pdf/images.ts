// Pictures onto PDF pages. JPGs go in untouched; everything else is decoded with sharp and embedded as PNG.
import { PDF_TEXT } from '@sparky/core'
import path from 'node:path'
import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle, type PDFDocument, type PDFImage } from 'pdf-lib'
import { readBytes } from './document'
import { placeImage, type LayoutOptions } from './layout'

/** What sharp reads here (no BMP or iPhone HEIC in its build). */
export const PICTURE_INPUTS = new Set(['png', 'jpg', 'webp', 'avif', 'tiff', 'gif'])

interface Picture {
  embed(doc: PDFDocument): Promise<PDFImage>
  width: number
  height: number
  dpi: number
}

async function readPicture(file: string): Promise<Picture> {
  const bytes = await readBytes(file)
  const fail = () => new Error(PDF_TEXT.notAnImage(path.basename(file)))
  const { default: sharp } = await import('sharp')
  const meta = await sharp(bytes).metadata().catch(() => {
    throw fail()
  })
  const dpi = meta.density && meta.density > 0 ? meta.density : 72
  // A plain RGB or grey JPG the right way up can be embedded byte for byte.
  if (meta.format === 'jpeg' && (meta.orientation ?? 1) === 1 && (meta.space === 'srgb' || meta.space === 'b-w') && meta.width && meta.height) {
    return { embed: (doc) => doc.embedJpg(bytes), width: meta.width, height: meta.height, dpi }
  }
  const { data, info } = await sharp(bytes, { animated: false })
    .rotate()
    .toColourspace('srgb')
    .png()
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      throw fail()
    })
  // pdf-lib reads the whole ArrayBuffer behind a view, so it gets a buffer of its own.
  return { embed: (doc) => doc.embedPng(new Uint8Array(data)), width: info.width, height: info.height, dpi }
}

/** Adds one page to `doc` holding the picture in `file`. */
export async function addPicturePage(doc: PDFDocument, file: string, layout: LayoutOptions): Promise<void> {
  const pic = await readPicture(file)
  const at = placeImage(pic.width, pic.height, pic.dpi, layout)
  const image = await pic.embed(doc)
  const page = doc.addPage([at.pageWidth, at.pageHeight])
  if (at.clip) page.pushOperators(pushGraphicsState(), rectangle(at.clip.x, at.clip.y, at.clip.width, at.clip.height), clip(), endPath())
  page.drawImage(image, { x: at.x, y: at.y, width: at.width, height: at.height })
  if (at.clip) page.pushOperators(popGraphicsState())
}
