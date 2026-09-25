// What Sparky can read, what it can write, and which tool does the work.
import { docTargetsFor } from './documents'

export type Category = 'video' | 'audio' | 'image' | 'document' | 'archive'

export const CATEGORIES: readonly Category[] = ['video', 'audio', 'image', 'document', 'archive']

export const CATEGORY_LABELS: Record<Category, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Images',
  document: 'Documents',
  archive: 'Archives',
}

/** Folder names under the output root. Downloads get their own folder. */
export const OUTPUT_FOLDERS: Record<Category | 'download', string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Images',
  document: 'Documents',
  archive: 'Archives',
  download: 'Downloads',
}

export interface FormatInfo {
  /** Lower-case extension without the dot. */
  ext: string
  label: string
  category: Category
  /** Short plain-language description for the format picker. */
  note: string
}

export const FORMATS: readonly FormatInfo[] = [
  { ext: 'mp4', label: 'MP4', category: 'video', note: 'Plays everywhere' },
  { ext: 'webm', label: 'WEBM', category: 'video', note: 'Great for the web' },
  { ext: 'mkv', label: 'MKV', category: 'video', note: 'Keeps every track' },
  { ext: 'mov', label: 'MOV', category: 'video', note: 'Apple and editing apps' },
  { ext: 'avi', label: 'AVI', category: 'video', note: 'Older players' },
  { ext: 'gif', label: 'GIF', category: 'video', note: 'Short looping clip' },
  { ext: 'mp3', label: 'MP3', category: 'audio', note: 'Plays everywhere' },
  { ext: 'wav', label: 'WAV', category: 'audio', note: 'Uncompressed' },
  { ext: 'flac', label: 'FLAC', category: 'audio', note: 'Full quality, smaller than WAV' },
  { ext: 'm4a', label: 'M4A', category: 'audio', note: 'Apple devices' },
  { ext: 'ogg', label: 'OGG', category: 'audio', note: 'Open format' },
  { ext: 'png', label: 'PNG', category: 'image', note: 'Sharp, keeps transparency' },
  { ext: 'jpg', label: 'JPG', category: 'image', note: 'Photos, small files' },
  { ext: 'webp', label: 'WEBP', category: 'image', note: 'Small files for the web' },
  { ext: 'avif', label: 'AVIF', category: 'image', note: 'Smallest modern format' },
  { ext: 'ico', label: 'ICO', category: 'image', note: 'Windows icons' },
  { ext: 'heic', label: 'HEIC', category: 'image', note: 'iPhone photos' },
  { ext: 'bmp', label: 'BMP', category: 'image', note: 'Uncompressed bitmap' },
  { ext: 'tiff', label: 'TIFF', category: 'image', note: 'Print and scans' },
  { ext: 'pdf', label: 'PDF', category: 'document', note: 'Looks the same everywhere' },
  { ext: 'docx', label: 'DOCX', category: 'document', note: 'Word document' },
  { ext: 'md', label: 'MD', category: 'document', note: 'Markdown text' },
  { ext: 'html', label: 'HTML', category: 'document', note: 'Web page' },
  { ext: 'txt', label: 'TXT', category: 'document', note: 'Plain text' },
  { ext: 'csv', label: 'CSV', category: 'document', note: 'Spreadsheet rows as text' },
  { ext: 'xlsx', label: 'XLSX', category: 'document', note: 'Excel workbook' },
  { ext: 'json', label: 'JSON', category: 'document', note: 'Data for programs' },
  { ext: 'xml', label: 'XML', category: 'document', note: 'Structured data' },
  { ext: 'zip', label: 'ZIP', category: 'archive', note: 'Opens on any PC' },
  { ext: '7z', label: '7Z', category: 'archive', note: 'Smaller archives' },
  { ext: 'rar', label: 'RAR', category: 'archive', note: 'Extract only' },
  { ext: 'folder', label: 'Folder', category: 'archive', note: 'Unpack the files' },
]

const ALIASES: Record<string, string> = {
  jpeg: 'jpg',
  jpe: 'jpg',
  htm: 'html',
  markdown: 'md',
  heif: 'heic',
  tif: 'tiff',
  oga: 'ogg',
  opus: 'ogg',
  aac: 'm4a',
  m4v: 'mp4',
}

/** Inputs Sparky accepts beyond the output list. */
const EXTRA_INPUTS: Record<string, Category> = {
  aac: 'audio',
  wma: 'audio',
  flv: 'video',
  wmv: 'video',
  ts: 'video',
  '3gp': 'video',
  mpg: 'video',
  mpeg: 'video',
  xls: 'document',
  doc: 'document',
  rtf: 'document',
  odt: 'document',
  ods: 'document',
  ppt: 'document',
  pptx: 'document',
  odp: 'document',
}

const OUTPUT_ONLY = new Set(['folder'])

/** Office files only LibreOffice opens, and what it can make of each. They light up once LibreOffice is found. */
const OFFICE_TARGETS: Record<string, readonly string[]> = {
  xls: ['pdf', 'xlsx'],
  ods: ['pdf', 'xlsx'],
  doc: ['pdf', 'docx'],
  rtf: ['pdf', 'docx'],
  odt: ['pdf', 'docx'],
  ppt: ['pdf'],
  pptx: ['pdf'],
  odp: ['pdf'],
}

/** Data formats only the engine's document module reads. */
const DATA_DOCS = new Set(['csv', 'xlsx', 'json', 'xml'])

/** The raw extension of a path or bare extension, ignoring dots in folder names. */
function rawExt(extOrPath: string): string {
  const name = extOrPath.slice(Math.max(extOrPath.lastIndexOf('/'), extOrPath.lastIndexOf('\\')) + 1)
  if (name.includes('.')) return name.slice(name.lastIndexOf('.') + 1).toLowerCase().trim()
  // A bare word ("mp4") is an extension; a path with no dot in its file name has none.
  return name === extOrPath ? name.toLowerCase().trim() : ''
}

export function normalizeExt(extOrPath: string): string {
  const ext = rawExt(extOrPath)
  return ALIASES[ext] ?? ext
}

export function formatInfo(ext: string): FormatInfo | undefined {
  const e = normalizeExt(ext)
  return FORMATS.find((f) => f.ext === e)
}

export function categoryOf(extOrPath: string): Category | undefined {
  const raw = rawExt(extOrPath)
  if (EXTRA_INPUTS[raw]) return EXTRA_INPUTS[raw]
  const e = normalizeExt(extOrPath)
  if (OUTPUT_ONLY.has(e)) return undefined
  return formatInfo(e)?.category ?? EXTRA_INPUTS[e]
}

export function isSupportedInput(path: string): boolean {
  return categoryOf(path) !== undefined
}

/** Every extension Sparky reads, lower case without the dot: the formats it writes, the extra inputs (the LibreOffice-gated Office files among them) and their aliases. */
export const INPUT_EXTS: readonly string[] = [...new Set([...FORMATS.map((f) => f.ext), ...Object.keys(EXTRA_INPUTS), ...Object.keys(ALIASES)])].filter(isSupportedInput)

/**
 * Formats a given input can become. Includes the input's own format, which
 * means "just make it smaller" (compress without converting), when that makes sense.
 */
export function outputsFor(extOrPath: string): FormatInfo[] {
  const input = normalizeExt(extOrPath)
  const category = categoryOf(extOrPath)
  if (!category) return []
  const pick = (exts: string[]) => exts.map((e) => formatInfo(e)!).filter(Boolean)
  switch (category) {
    case 'video':
      // Video can also drop the picture and keep just the sound.
      return pick(['mp4', 'webm', 'mkv', 'mov', 'gif', 'mp3', 'm4a', 'wav', 'flac', 'ogg'])
    case 'audio':
      return pick(['mp3', 'wav', 'flac', 'm4a', 'ogg'])
    case 'image':
      return pick(['png', 'jpg', 'webp', 'avif', 'tiff', 'ico'])
    case 'document':
      if (input === 'pdf') return pick(['pdf', 'txt', 'md', 'html'])
      // Old Excel and the other Office files go through LibreOffice only.
      if (OFFICE_TARGETS[input]) return pick([...OFFICE_TARGETS[input]])
      if (DATA_DOCS.has(input)) return pick([...docTargetsFor(input)])
      return pick(['pdf', 'docx', 'md', 'html', 'txt']).filter((f) => f.ext !== input)
    case 'archive':
      return pick(['zip', '7z', 'folder'])
  }
}

export function canConvert(from: string, to: string): boolean {
  return outputsFor(from).some((f) => f.ext === normalizeExt(to))
}

/** True when the output keeps the input's format, so the job only shrinks the file. */
export function isCompressOnly(from: string, to: string): boolean {
  return normalizeExt(from) === normalizeExt(to)
}

/** Whether the Compression slider does anything for this output. */
export function compressionApplies(output: string, available: { ghostscript: boolean } = { ghostscript: true }): boolean {
  const ext = normalizeExt(output)
  if (ext === 'pdf') return available.ghostscript
  // TIFF is written lossless (LZW) for print, so there is nothing to trade.
  if (ext === 'folder' || ext === 'wav' || ext === 'flac' || ext === 'bmp' || ext === 'tiff') return false
  const cat = formatInfo(ext)?.category
  return cat === 'video' || cat === 'audio' || cat === 'image' || cat === 'archive'
}

/** Whether a Resolution choice makes sense for this output. */
export function resolutionApplies(output: string): boolean {
  const ext = normalizeExt(output)
  return formatInfo(ext)?.category === 'video' && ext !== 'gif'
}

export type Engine = 'ffmpeg' | 'sharp' | 'pandoc' | 'pdf-print' | 'libreoffice' | 'ghostscript' | 'pdf-text' | '7zip' | 'document'

const SHARP_IN = new Set(['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'])
const SHARP_OUT = new Set(['png', 'jpg', 'webp', 'avif', 'tiff'])

export interface EngineContext {
  libreoffice: boolean
}

/** Picks the tool for a conversion. Returns undefined when it can't be done. */
export function engineFor(from: string, to: string, ctx: EngineContext = { libreoffice: false }): Engine | undefined {
  if (!canConvert(from, to)) return undefined
  const input = normalizeExt(from)
  const output = normalizeExt(to)
  const category = categoryOf(from)!
  switch (category) {
    case 'video':
    case 'audio':
      return 'ffmpeg'
    case 'image':
      return SHARP_IN.has(input) && SHARP_OUT.has(output) ? 'sharp' : 'ffmpeg'
    case 'archive':
      return '7zip'
    case 'document':
      if (OFFICE_TARGETS[input]) return ctx.libreoffice ? 'libreoffice' : undefined
      if (input === 'pdf') return output === 'pdf' ? 'ghostscript' : output === 'html' ? 'document' : 'pdf-text'
      // Pairs Pandoc and printing already handle keep them; the document module takes the rest of its matrix.
      if (DATA_DOCS.has(input) && (docTargetsFor(input) as readonly string[]).includes(output)) return 'document'
      if (output === 'pdf') return input === 'docx' && ctx.libreoffice ? 'libreoffice' : 'pdf-print'
      return 'pandoc'
  }
}
