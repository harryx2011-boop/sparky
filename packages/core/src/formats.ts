// What Sparky can read, what it can write, and which tool does the work.

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
  { ext: 'pdf', label: 'PDF', category: 'document', note: 'Looks the same everywhere' },
  { ext: 'docx', label: 'DOCX', category: 'document', note: 'Word document' },
  { ext: 'md', label: 'MD', category: 'document', note: 'Markdown text' },
  { ext: 'html', label: 'HTML', category: 'document', note: 'Web page' },
  { ext: 'txt', label: 'TXT', category: 'document', note: 'Plain text' },
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
  tiff: 'image',
  aac: 'audio',
  wma: 'audio',
  flv: 'video',
  wmv: 'video',
  ts: 'video',
  '3gp': 'video',
  mpg: 'video',
  mpeg: 'video',
}

const OUTPUT_ONLY = new Set(['folder'])

export function normalizeExt(extOrPath: string): string {
  const raw = extOrPath.includes('.') ? extOrPath.slice(extOrPath.lastIndexOf('.') + 1) : extOrPath
  const ext = raw.toLowerCase().trim()
  return ALIASES[ext] ?? ext
}

export function formatInfo(ext: string): FormatInfo | undefined {
  const e = normalizeExt(ext)
  return FORMATS.find((f) => f.ext === e)
}

export function categoryOf(extOrPath: string): Category | undefined {
  const raw = extOrPath.includes('.') ? extOrPath.slice(extOrPath.lastIndexOf('.') + 1).toLowerCase() : extOrPath.toLowerCase()
  if (EXTRA_INPUTS[raw]) return EXTRA_INPUTS[raw]
  const e = normalizeExt(extOrPath)
  if (OUTPUT_ONLY.has(e)) return undefined
  return formatInfo(e)?.category ?? EXTRA_INPUTS[e]
}

export function isSupportedInput(path: string): boolean {
  return categoryOf(path) !== undefined
}

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
      return pick(['png', 'jpg', 'webp', 'avif', 'ico'])
    case 'document':
      if (input === 'pdf') return pick(['pdf', 'txt', 'md'])
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
  if (ext === 'folder' || ext === 'wav' || ext === 'flac' || ext === 'bmp') return false
  const cat = formatInfo(ext)?.category
  return cat === 'video' || cat === 'audio' || cat === 'image' || cat === 'archive'
}

/** Whether a Resolution choice makes sense for this output. */
export function resolutionApplies(output: string): boolean {
  const ext = normalizeExt(output)
  return formatInfo(ext)?.category === 'video' && ext !== 'gif'
}

export type Engine = 'ffmpeg' | 'sharp' | 'pandoc' | 'pdf-print' | 'libreoffice' | 'ghostscript' | 'pdf-text' | '7zip'

const SHARP_IN = new Set(['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'])
const SHARP_OUT = new Set(['png', 'jpg', 'webp', 'avif'])

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
      if (input === 'pdf') return output === 'pdf' ? 'ghostscript' : 'pdf-text'
      if (output === 'pdf') return input === 'docx' && ctx.libreoffice ? 'libreoffice' : 'pdf-print'
      return 'pandoc'
  }
}
