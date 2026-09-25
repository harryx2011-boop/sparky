// Extension → vendored vscode-icons SVG. Self-contained (no Sparky imports) so another app can copy this folder.
import { FILE_ICON_SVGS, type FileIconName } from './svgs'

export type { FileIconName }

export type FileFamily = 'video' | 'audio' | 'image' | 'document' | 'archive'

/** The icon for a file whose own format has no specific one. */
export const FAMILY_ICONS: Record<FileFamily, FileIconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  document: 'text',
  archive: 'zip',
}

const F = FAMILY_ICONS

/** One row per extension, lower case without the dot. */
export const EXT_ICONS: Readonly<Record<string, FileIconName>> = {
  mp4: F.video, m4v: F.video, webm: F.video, mkv: F.video, mov: F.video, avi: F.video, flv: F.video,
  wmv: F.video, ts: F.video, mts: F.video, m2ts: F.video, '3gp': F.video, mpg: F.video, mpeg: F.video,

  mp3: F.audio, wav: F.audio, flac: F.audio, m4a: F.audio, ogg: F.audio, oga: F.audio, opus: F.audio,
  aac: F.audio, wma: F.audio, aiff: F.audio, aif: F.audio,

  png: F.image, jpg: F.image, jpeg: F.image, jpe: F.image, webp: F.image, gif: F.image, ico: F.image,
  heic: F.image, heif: F.image, bmp: F.image, tiff: F.image, tif: F.image,
  avif: 'avif',
  svg: 'svg',

  pdf: 'pdf2',
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  ppt: 'powerpoint', pptx: 'powerpoint',
  odt: 'libreoffice_writer', ods: 'libreoffice_calc', odp: 'libreoffice_impress',
  md: 'markdown', markdown: 'markdown',
  html: 'html', htm: 'html',
  json: 'json',
  xml: 'xml',
  epub: 'epub',
  txt: F.document, rtf: F.document, csv: F.document, log: F.document,

  zip: F.archive, '7z': F.archive, rar: F.archive, tar: F.archive, gz: F.archive, tgz: F.archive,
  folder: 'default_folder',
}

/** Extensions whose Windows association usually names a different format (.ts is TypeScript to VS Code, a video stream here), so the pack icon always wins. */
export const PACK_ONLY_EXTS: ReadonlySet<string> = new Set(['ts', 'mts'])

/** "C:\\a\\Clip.MP4", ".mp4" and "mp4" all give "mp4". */
export function extOf(nameOrExt: string): string {
  const base = nameOrExt.slice(Math.max(nameOrExt.lastIndexOf('/'), nameOrExt.lastIndexOf('\\')) + 1)
  return base.slice(base.lastIndexOf('.') + 1).trim().toLowerCase()
}

/** The icon for an extension: its own, else its family's (when the caller knows it), else a plain page. */
export function fileIconName(ext: string, family?: FileFamily): FileIconName {
  return EXT_ICONS[extOf(ext)] ?? (family ? FAMILY_ICONS[family] : 'default_file')
}

export function fileIconFor(ext: string, family?: FileFamily): { name: FileIconName; svg: string } {
  const name = fileIconName(ext, family)
  return { name, svg: FILE_ICON_SVGS[name] }
}
