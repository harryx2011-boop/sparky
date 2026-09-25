// Option shapes for the media and document operations, and the checks that keep them in range.
import { isMediaFormat, type MediaFormat } from './ffmpeg-ops'

export class ValidationError extends Error {}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new ValidationError(message)
}

function inRange(value: number, min: number, max: number, label: string): void {
  assert(Number.isFinite(value), `${label} must be a finite number.`)
  assert(value >= min && value <= max, `${label} must be between ${min} and ${max}.`)
}

function atLeast(value: number, min: number, label: string): void {
  assert(Number.isFinite(value), `${label} must be a finite number.`)
  assert(value >= min, `${label} must be at least ${min}.`)
}

export type Trim = { start: number; end: number }
export type Crop = { x: number; y: number; width: number; height: number }
export type Rotation = 0 | 90 | 180 | 270
export type Flip = 'h' | 'v' | 'hv'

export type ConvertOptions = {
  crf?: number
  videoBitrate?: number
  audioBitrate?: number
  width?: number
  height?: number
  fps?: number
  rotate?: Rotation
  flip?: Flip
  trim?: Trim
  crop?: Crop
  preset?: 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow'
  stripAudio?: boolean
  targetBytes?: number
}

export type CompressOptions = ConvertOptions & {
  target?: number
  quality?: 'email' | 'discord' | 'web' | 'archive'
}

/** One shape for all three thumbnail modes; only the framing differs. */
export type ThumbsOptions = {
  mode: 'poster' | 'sprite' | 'preview'
  width: number
  /** poster and preview: where to start, in seconds. */
  at?: number
  /** sprite: how many frames to lay out, and how many per row. */
  count?: number
  columns?: number
  /** preview: how long, and how smooth. */
  durationSec?: number
  fps?: number
}

export type GifOptions = {
  fps: number
  width: number
  trim?: Trim
  loop: boolean
  dither: 'none' | 'bayer' | 'floyd_steinberg' | 'sierra2_4a'
}

export type ImageOptions = {
  quality?: number
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  rotate?: Rotation
  flip?: Flip
  lossless?: boolean
}

const DIMENSION_MIN = 16
const PRESETS = new Set(['ultrafast', 'veryfast', 'fast', 'medium', 'slow'])
const FITS = new Set(['cover', 'contain', 'fill', 'inside', 'outside'])
const DITHERS = new Set(['none', 'bayer', 'floyd_steinberg', 'sierra2_4a'])
const ROTATIONS = new Set([0, 90, 180, 270])
const FLIPS = new Set(['h', 'v', 'hv'])
const QUALITIES = new Set(['email', 'discord', 'web', 'archive'])

function checkDimension(value: number | undefined, label: string): void {
  if (value === undefined) return
  atLeast(value, DIMENSION_MIN, label)
}

function checkTrim(trim: Trim | undefined): void {
  if (!trim) return
  atLeast(trim.start, 0, 'trim.start')
  atLeast(trim.end, 0, 'trim.end')
  assert(trim.end > trim.start, 'trim.end must be greater than trim.start.')
}

function checkCrop(crop: Crop | undefined): void {
  if (!crop) return
  atLeast(crop.x, 0, 'crop.x')
  atLeast(crop.y, 0, 'crop.y')
  checkDimension(crop.width, 'crop.width')
  checkDimension(crop.height, 'crop.height')
}

function checkRotate(rotate: Rotation | undefined): void {
  if (rotate === undefined) return
  assert(ROTATIONS.has(rotate), 'rotate must be 0, 90, 180 or 270.')
}

function checkFlip(flip: Flip | undefined): void {
  if (flip === undefined) return
  assert(FLIPS.has(flip), "flip must be 'h', 'v' or 'hv'.")
}

export function validateConvertOptions(o: ConvertOptions): void {
  if (o.crf !== undefined) inRange(o.crf, 0, 51, 'crf')
  if (o.videoBitrate !== undefined) atLeast(o.videoBitrate, 1_000, 'videoBitrate')
  if (o.audioBitrate !== undefined) atLeast(o.audioBitrate, 8_000, 'audioBitrate')
  checkDimension(o.width, 'width')
  checkDimension(o.height, 'height')
  if (o.fps !== undefined) inRange(o.fps, 1, 240, 'fps')
  checkRotate(o.rotate)
  checkFlip(o.flip)
  checkTrim(o.trim)
  checkCrop(o.crop)
  if (o.preset !== undefined) assert(PRESETS.has(o.preset), 'preset is not a known ffmpeg preset.')
  if (o.targetBytes !== undefined) atLeast(o.targetBytes, 64_000, 'targetBytes')
}

export function validateCompressOptions(o: CompressOptions): void {
  validateConvertOptions(o)
  if (o.target !== undefined) atLeast(o.target, 64_000, 'target')
  if (o.quality !== undefined) assert(QUALITIES.has(o.quality), 'quality must be one of email, discord, web, archive.')
}

export function validateGifOptions(o: GifOptions): void {
  inRange(o.fps, 1, 50, 'fps')
  checkDimension(o.width, 'width')
  checkTrim(o.trim)
  assert(typeof o.loop === 'boolean', 'loop must be a boolean.')
  assert(DITHERS.has(o.dither), 'dither is not a known algorithm.')
}

export function validateThumbsOptions(o: ThumbsOptions): void {
  assert(o.mode === 'poster' || o.mode === 'sprite' || o.mode === 'preview', 'mode must be poster, sprite or preview.')
  checkDimension(o.width, 'width')
  if (o.at !== undefined) assert(o.at >= 0, 'at must not be negative.')
  if (o.count !== undefined) atLeast(o.count, 1, 'count')
  if (o.columns !== undefined) atLeast(o.columns, 1, 'columns')
  if (o.durationSec !== undefined) atLeast(o.durationSec, 0.1, 'durationSec')
  if (o.fps !== undefined) inRange(o.fps, 1, 30, 'fps')
}

export function validateImageOptions(o: ImageOptions): void {
  if (o.quality !== undefined) inRange(o.quality, 1, 100, 'quality')
  checkDimension(o.width, 'width')
  checkDimension(o.height, 'height')
  if (o.fit !== undefined) assert(FITS.has(o.fit), 'fit is not a known resize mode.')
  checkRotate(o.rotate)
  checkFlip(o.flip)
}

export function validateMediaFormat(value: string, label = 'format'): MediaFormat {
  assert(isMediaFormat(value), `${label} '${value}' is not a supported format.`)
  return value as MediaFormat
}

/** Size a compress preset aims for, in bytes. Null means quality-led, no size goal. */
export const PRESET_TARGETS: Record<'email' | 'discord' | 'web' | 'archive', number | null> = {
  email: 25 * 1024 * 1024,
  discord: 10 * 1024 * 1024,
  web: null,
  archive: null,
}

/** Presentation choices for document conversion. None of these paths is lossy in the codec sense. */
export type DocumentOptions = {
  /** Delimiter for csv in and out. Tab covers the .tsv-in-a-.csv case. */
  delimiter?: ',' | ';' | '\t' | '|'
  /** Treat the first row as headers when reading, and emit them when writing. */
  header?: boolean
  /** Which sheet to read from a workbook: index or name. Default: the first. */
  sheet?: number | string
  /** Indent for json output. 0 emits a single line. */
  indent?: 0 | 2 | 4
  pageSize?: 'a4' | 'letter' | 'legal'
  orientation?: 'portrait' | 'landscape'
}

const DELIMITERS = new Set([',', ';', '\t', '|'])
const INDENTS = new Set([0, 2, 4])
const PAGE_SIZES = new Set(['a4', 'letter', 'legal'])
const ORIENTATIONS = new Set(['portrait', 'landscape'])

export function validateDocumentOptions(o: DocumentOptions): void {
  if (o.delimiter !== undefined) assert(DELIMITERS.has(o.delimiter), 'delimiter must be one of , ; tab or |.')
  if (o.indent !== undefined) assert(INDENTS.has(o.indent), 'indent must be 0, 2 or 4.')
  if (o.pageSize !== undefined) assert(PAGE_SIZES.has(o.pageSize), 'pageSize must be a4, letter or legal.')
  if (o.orientation !== undefined) assert(ORIENTATIONS.has(o.orientation), 'orientation must be portrait or landscape.')
  if (typeof o.sheet === 'number') {
    atLeast(o.sheet, 0, 'sheet')
    assert(Number.isInteger(o.sheet), 'sheet must be a whole number.')
  }
}
