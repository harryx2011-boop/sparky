// Where a picture sits on a PDF page. Units are PDF points (1/72 inch).
import { PDF_TEXT } from '@sparky/core'

export type PageSize = 'fit' | 'a4' | 'a3' | 'letter' | 'legal'
export type Orientation = 'auto' | 'portrait' | 'landscape'
export type Fit = 'contain' | 'cover'

/** Portrait width and height. */
export const PAGE_SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  letter: [612, 792],
  legal: [612, 1008],
}

export const mmToPt = (mm: number) => (mm * 72) / 25.4

export interface Placement {
  pageWidth: number
  pageHeight: number
  x: number
  y: number
  width: number
  height: number
  /** The picture overflows its box (cover), so it is clipped to it. */
  clip?: { x: number; y: number; width: number; height: number }
}

export interface LayoutOptions {
  pageSize: PageSize
  orientation: Orientation
  marginMm: number
  fit: Fit
}

/** `fit` makes the page the picture's own size at its DPI (plus margins); a paper size centres it inside the margins. */
export function placeImage(pxWidth: number, pxHeight: number, dpi: number, o: LayoutOptions): Placement {
  const m = mmToPt(o.marginMm)
  const w = (pxWidth * 72) / dpi
  const h = (pxHeight * 72) / dpi
  if (o.pageSize === 'fit') return { pageWidth: w + 2 * m, pageHeight: h + 2 * m, x: m, y: m, width: w, height: h }

  const [pw, ph] = PAGE_SIZES[o.pageSize]
  const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && pxWidth > pxHeight)
  const pageWidth = landscape ? ph : pw
  const pageHeight = landscape ? pw : ph
  const boxW = pageWidth - 2 * m
  const boxH = pageHeight - 2 * m
  if (boxW <= 0 || boxH <= 0) throw new Error(PDF_TEXT.marginTooBig)
  const scale = (o.fit === 'cover' ? Math.max : Math.min)(boxW / w, boxH / h)
  const width = w * scale
  const height = h * scale
  const placed = { pageWidth, pageHeight, x: m + (boxW - width) / 2, y: m + (boxH - height) / 2, width, height }
  return o.fit === 'cover' ? { ...placed, clip: { x: m, y: m, width: boxW, height: boxH } } : placed
}
