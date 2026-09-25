// Document formats handled by the engine's document module, and which pairs it can produce.
// Documents share no universal intermediate, so the matrix is explicit rather than derived.
// .xls is not here: LibreOffice converts it when installed.

export const TABLE_FORMATS = ['csv', 'xlsx', 'json'] as const
export const TEXT_FORMATS = ['md', 'html', 'txt', 'xml'] as const
export const PAGE_FORMATS = ['pdf'] as const

export const DOC_FORMATS = [...TABLE_FORMATS, ...TEXT_FORMATS, ...PAGE_FORMATS] as const

export type DocFormat = (typeof DOC_FORMATS)[number]

/** Which pipeline a format goes through: rows, rich text, or a page. */
export type DocFamily = 'table' | 'text' | 'page'

const DOC_SET = new Set<string>(DOC_FORMATS)

export function isDocFormat(value: string): value is DocFormat {
  return DOC_SET.has(value)
}

export function docFamily(format: DocFormat): DocFamily {
  if ((TABLE_FORMATS as readonly string[]).includes(format)) return 'table'
  if ((PAGE_FORMATS as readonly string[]).includes(format)) return 'page'
  return 'text'
}

export const DOC_MIME: Record<DocFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  md: 'text/markdown',
  html: 'text/html',
  txt: 'text/plain',
  xml: 'application/xml',
  pdf: 'application/pdf',
}

/**
 * Source format to the targets the document module can produce.
 * Table formats all lower to rows, so they interconvert. PDF is one-way in each direction:
 * text out of a PDF, or a PDF rendered from text. A PDF table is glyphs placed on a page, and
 * rebuilding cells from it gives confidently wrong numbers, so there is no pdf to csv or xlsx.
 */
export const DOC_TARGETS: Record<DocFormat, readonly DocFormat[]> = {
  csv: ['xlsx', 'json', 'xml', 'html', 'md', 'txt', 'pdf'],
  xlsx: ['csv', 'json', 'xml', 'html', 'md', 'txt', 'pdf'],
  // Only an array of flat objects becomes rows; anything else fails with a plain-language error.
  json: ['csv', 'xlsx', 'xml', 'txt', 'html', 'md', 'pdf'],

  md: ['html', 'txt', 'pdf'],
  html: ['md', 'txt', 'pdf'],
  txt: ['md', 'html', 'pdf'],
  xml: ['json', 'txt', 'html', 'pdf'],

  pdf: ['txt', 'md', 'html'],
}

const DOC_ALIASES: Record<string, DocFormat> = {
  markdown: 'md',
  mdown: 'md',
  htm: 'html',
  text: 'txt',
  log: 'txt',
}

/** Canonical document extension for an extension or alias, with or without the dot. */
export function normalizeDocExt(ext: string): DocFormat | null {
  const lower = ext.toLowerCase().replace(/^\./, '')
  if (isDocFormat(lower)) return lower
  return DOC_ALIASES[lower] ?? null
}

export function docTargetsFor(ext: string): readonly DocFormat[] {
  const format = normalizeDocExt(ext)
  return format ? DOC_TARGETS[format] : []
}

/** Every extension the document module reads, aliases included. */
export const DOC_INPUT_EXTS: readonly string[] = [...DOC_FORMATS, ...Object.keys(DOC_ALIASES)]
