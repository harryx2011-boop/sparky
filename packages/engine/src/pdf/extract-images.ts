// Pulls the pictures out of a PDF. JPG and JPEG 2000 streams are written as they are; other grey, RGB, CMYK
// and indexed samples (1, 2, 4 or 8 bits) are rebuilt into PNG with sharp. The rest are counted as skipped.
import {
  decodePDFRawStream,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
  type PDFDocument,
  type PDFObject,
} from 'pdf-lib'

export interface PdfImage {
  ext: 'jpg' | 'jp2' | 'png'
  data: Buffer
}

/** Every image stream the file holds, less the ones used only as another image's transparency. */
export function imageStreams(doc: PDFDocument): PDFRawStream[] {
  const images: PDFRawStream[] = []
  const masks = new Set<PDFObject>()
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue
    images.push(obj)
    for (const key of ['SMask', 'Mask']) {
      const ref = obj.dict.get(PDFName.of(key))
      if (ref instanceof PDFRef) masks.add(doc.context.lookup(ref) as PDFObject)
    }
  }
  return images.filter((s) => !masks.has(s))
}

function filters(dict: PDFDict): string[] {
  const f = dict.lookup(PDFName.of('Filter'))
  if (f instanceof PDFName) return [f.decodeText()]
  if (f instanceof PDFArray) return f.asArray().map((x) => (x instanceof PDFName ? x.decodeText() : ''))
  return []
}

function num(dict: PDFDict, key: string): number | undefined {
  const v = dict.lookup(PDFName.of(key))
  return v instanceof PDFNumber ? v.asNumber() : undefined
}

interface ColourSpace {
  components: number
  /** RGB lookup table for an indexed space. */
  palette?: Uint8Array
  cmyk?: boolean
}

function bytesOf(obj: PDFObject | undefined): Uint8Array | undefined {
  if (obj instanceof PDFHexString || obj instanceof PDFString) return obj.asBytes()
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode()
  return undefined
}

function toRgb(px: Uint8Array, cs: ColourSpace): [number, number, number] {
  if (cs.components === 1) return [px[0]!, px[0]!, px[0]!]
  if (cs.cmyk) {
    const k = 1 - px[3]! / 255
    return [Math.round((255 - px[0]!) * k), Math.round((255 - px[1]!) * k), Math.round((255 - px[2]!) * k)]
  }
  return [px[0]!, px[1]!, px[2]!]
}

const byComponents = (n: number | undefined): ColourSpace | undefined =>
  n === 1 ? { components: 1 } : n === 3 ? { components: 3 } : n === 4 ? { components: 4, cmyk: true } : undefined

function colourSpace(doc: PDFDocument, value: PDFObject | undefined): ColourSpace | undefined {
  const cs = value instanceof PDFRef ? doc.context.lookup(value) : value
  if (cs instanceof PDFName) {
    const name = cs.decodeText()
    if (name === 'DeviceGray' || name === 'G') return byComponents(1)
    if (name === 'DeviceRGB' || name === 'RGB') return byComponents(3)
    if (name === 'DeviceCMYK' || name === 'CMYK') return byComponents(4)
    return undefined
  }
  if (!(cs instanceof PDFArray) || cs.size() === 0) return undefined
  const kind = cs.lookup(0)
  const name = kind instanceof PDFName ? kind.decodeText() : ''
  if (name === 'ICCBased') {
    const stream = cs.lookup(1)
    return byComponents(stream instanceof PDFRawStream ? num(stream.dict, 'N') : undefined)
  }
  if (name === 'CalRGB') return byComponents(3)
  if (name === 'CalGray') return byComponents(1)
  if (name === 'Indexed' || name === 'I') {
    const base = colourSpace(doc, cs.get(1))
    const table = bytesOf(cs.lookup(3))
    if (!base || base.palette || !table) return undefined
    const rgb = new Uint8Array(256 * 3)
    for (let i = 0; i < 256 && (i + 1) * base.components <= table.length; i++) {
      rgb.set(toRgb(table.subarray(i * base.components, (i + 1) * base.components), base), i * 3)
    }
    return { components: 1, palette: rgb }
  }
  return undefined
}

/** Undoes the PNG row filters (Predictor 10 to 15). */
export function unpredictPng(data: Uint8Array, rowBytes: number, bytesPerPixel: number): Uint8Array {
  const rows = Math.floor(data.length / (rowBytes + 1))
  const out = new Uint8Array(rows * rowBytes)
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowBytes + 1)]!
    const src = r * (rowBytes + 1) + 1
    const dst = r * rowBytes
    for (let i = 0; i < rowBytes; i++) {
      const raw = data[src + i]!
      const left = i >= bytesPerPixel ? out[dst + i - bytesPerPixel]! : 0
      const up = r > 0 ? out[dst - rowBytes + i]! : 0
      const upLeft = r > 0 && i >= bytesPerPixel ? out[dst - rowBytes + i - bytesPerPixel]! : 0
      let v = raw
      if (type === 1) v = raw + left
      else if (type === 2) v = raw + up
      else if (type === 3) v = raw + ((left + up) >> 1)
      else if (type === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      }
      out[dst + i] = v & 0xff
    }
  }
  return out
}

const PLAIN_FILTERS = new Set(['FlateDecode', 'LZWDecode', 'ASCII85Decode', 'ASCIIHexDecode', 'RunLengthDecode'])

/** One image stream as a file's bytes, or undefined when Sparky can't rebuild it. */
export async function extractImage(doc: PDFDocument, stream: PDFRawStream): Promise<PdfImage | undefined> {
  const dict = stream.dict
  const f = filters(dict)
  if (f.length === 1 && f[0] === 'DCTDecode') return { ext: 'jpg', data: Buffer.from(stream.contents) }
  if (f.length === 1 && f[0] === 'JPXDecode') return { ext: 'jp2', data: Buffer.from(stream.contents) }
  if (dict.lookup(PDFName.of('ImageMask')) === PDFBool.True) return undefined
  if (f.some((x) => !PLAIN_FILTERS.has(x))) return undefined

  const width = num(dict, 'Width')
  const height = num(dict, 'Height')
  const bpc = num(dict, 'BitsPerComponent') ?? 8
  const cs = colourSpace(doc, dict.get(PDFName.of('ColorSpace')))
  if (!width || !height || !cs || ![1, 2, 4, 8].includes(bpc)) return undefined

  let samples: Uint8Array
  try {
    samples = f.length ? decodePDFRawStream(stream).decode() : stream.contents
  } catch {
    return undefined
  }
  const rowBytes = Math.ceil((width * cs.components * bpc) / 8)
  const parms = dict.lookup(PDFName.of('DecodeParms'))
  const predictor = parms instanceof PDFDict ? (num(parms, 'Predictor') ?? 1) : 1
  if (predictor >= 10) samples = unpredictPng(samples, rowBytes, Math.max(1, Math.ceil((cs.components * bpc) / 8)))
  else if (predictor !== 1) return undefined
  if (samples.length < rowBytes * height) return undefined

  const decode = dict.lookup(PDFName.of('Decode'))
  const first = decode instanceof PDFArray ? decode.lookup(0) : undefined
  const invert = cs.components === 1 && !cs.palette && first instanceof PDFNumber && first.asNumber() === 1
  const channels = cs.components === 1 && !cs.palette ? 1 : 3
  const pixels = Buffer.alloc(width * height * channels)
  const max = (1 << bpc) - 1
  const px = new Uint8Array(cs.components)
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < cs.components; c++) {
        const i = x * cs.components + c
        const bit = i * bpc
        const v = bpc === 8 ? samples[row + i]! : (samples[row + (bit >> 3)]! >> (8 - bpc - (bit & 7))) & max
        px[c] = cs.palette ? v : Math.round((v * 255) / max)
      }
      const o = (y * width + x) * channels
      if (cs.palette) pixels.set(cs.palette.subarray(px[0]! * 3, px[0]! * 3 + 3), o)
      else if (channels === 1) pixels[o] = invert ? 255 - px[0]! : px[0]!
      else pixels.set(toRgb(px, cs), o)
    }
  }
  const { default: sharp } = await import('sharp')
  const data = await sharp(pixels, { raw: { width, height, channels: channels as 1 | 3 } }).png().toBuffer()
  return { ext: 'png', data }
}
