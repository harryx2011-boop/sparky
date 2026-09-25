// Reads an op's JSON Schema into form fields, and words what an op is missing. Nothing here names an op.
import { CATEGORY_LABELS, categoryOf, OPTIONAL_TOOLS, TOOL_NAMES, type Category, type OpSummary, type ToolStatus } from '@sparky/core'

export type FieldKind = 'files' | 'file' | 'text' | 'number' | 'boolean' | 'choice' | 'list'

export interface Choice {
  value: string | number
  label: string
}

export interface FieldSpec {
  key: string
  label: string
  hint?: string
  kind: FieldKind
  required: boolean
  default?: unknown
  min?: number
  max?: number
  integer?: boolean
  options?: Choice[]
  /** For lists: numbers or text. */
  numeric?: boolean
  /** A password or similar: typed hidden, never kept by the engine. */
  secret?: boolean
}

type Schema = Record<string, unknown>

const WORDS: Record<string, string> = { mb: 'MB', kb: 'KB', dpi: 'DPI', pdf: 'PDF', pdfs: 'PDFs', gif: 'GIF', ico: 'ICO', url: 'link', urls: 'links', fps: 'frames per second', px: 'px' }

/** "targetMb" → "Target MB", "page_size" → "Page size". */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase())
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Choice labels come from the field's `labels` meta (`.meta({ labels: { h: 'Side to side' } })`), else the value made readable. */
function consts(s: Schema): Choice[] | undefined {
  const labels = (s.labels && typeof s.labels === 'object' ? s.labels : {}) as Record<string, unknown>
  const choice = (v: string | number): Choice => ({ value: v, label: typeof labels[String(v)] === 'string' ? (labels[String(v)] as string) : humanize(String(v)) })
  if (Array.isArray(s.enum)) return (s.enum as (string | number)[]).map(choice)
  const variants = (s.anyOf ?? s.oneOf) as Schema[] | undefined
  if (!Array.isArray(variants)) return undefined
  const real = variants.filter((v) => v.type !== 'null')
  if (!real.length || !real.every((v) => 'const' in v)) return undefined
  return real.map((v) => choice(v.const as string | number))
}

function bound(s: Schema, inclusive: 'minimum' | 'maximum', exclusive: 'exclusiveMinimum' | 'exclusiveMaximum'): number | undefined {
  if (typeof s[inclusive] === 'number') return s[inclusive] as number
  if (typeof s[exclusive] === 'number') return s[exclusive] as number
  return undefined
}

/** Every field but `out`, required ones first, in the schema's own order. */
export function fieldsOf(op: OpSummary): FieldSpec[] {
  const props = (op.inputSchema.properties ?? {}) as Record<string, Schema>
  const required = new Set((op.inputSchema.required as string[] | undefined) ?? [])
  const first = op.positional[0]
  const secret = new Set(op.secret ?? [])
  const fields = Object.entries(props)
    .filter(([key]) => key !== 'out')
    .map(([key, s]): FieldSpec => {
      const base = { key, label: typeof s.title === 'string' ? s.title : humanize(key), hint: typeof s.description === 'string' ? s.description : undefined, required: required.has(key), default: s.default, secret: secret.has(key) || undefined }
      const options = consts(s)
      if (options) return { ...base, kind: 'choice', options }
      if (s.type === 'array') {
        const items = (s.items ?? {}) as Schema
        const numeric = items.type === 'number' || items.type === 'integer'
        if (!numeric && (key === 'files' || key === first)) return { ...base, kind: 'files' }
        return { ...base, kind: 'list', numeric }
      }
      if (s.type === 'boolean') return { ...base, kind: 'boolean' }
      if (s.type === 'number' || s.type === 'integer') return { ...base, kind: 'number', integer: s.type === 'integer', min: bound(s, 'minimum', 'exclusiveMinimum'), max: bound(s, 'maximum', 'exclusiveMaximum') }
      if (s.type === 'string' && key === first) return { ...base, kind: 'file' }
      return { ...base, kind: 'text' }
    })
  return [...fields.filter((f) => f.required), ...fields.filter((f) => !f.required)]
}

export type Values = Record<string, unknown>

/** The form's starting values: the schema's defaults, else empty. */
export function initial(fields: FieldSpec[]): Values {
  const v: Values = {}
  for (const f of fields) {
    if (f.default !== undefined) v[f.key] = f.kind === 'number' ? String(f.default) : f.default
    else if (f.kind === 'files' || f.kind === 'list') v[f.key] = []
    else if (f.kind === 'boolean') v[f.key] = false
    else if (f.kind === 'choice' && f.required) v[f.key] = f.options?.[0]?.value
    else if (f.kind === 'number' || f.kind === 'text' || f.kind === 'file') v[f.key] = ''
  }
  return v
}

/** What the person set. Empty fields are left out for the engine's own defaults; a switch with a default is always sent, so turning a default-on switch off reaches the engine. */
export function toArgs(fields: FieldSpec[], values: Values): Values {
  const args: Values = {}
  for (const f of fields) {
    const v = values[f.key]
    if (f.kind === 'boolean') {
      const on = Boolean(v)
      if (on || f.default !== undefined || f.required) args[f.key] = on
      continue
    }
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (f.kind === 'number') {
      const n = Number(v)
      if (Number.isFinite(n)) args[f.key] = n
    } else args[f.key] = v
  }
  return args
}

/** The first required field left empty, with a plain line for it. */
export function missingRequired(fields: FieldSpec[], values: Values): { key: string; message: string } | undefined {
  for (const f of fields) {
    if (!f.required || f.kind === 'boolean') continue
    const v = values[f.key]
    if (!(v === undefined || v === '' || (Array.isArray(v) && v.length === 0))) continue
    return { key: f.key, message: f.kind === 'files' ? 'Add at least one file.' : f.kind === 'file' ? 'Add a file.' : 'Fill this in to start.' }
  }
  return undefined
}

/** Whether a field error from the engine ("files.1", "pages") belongs to this field. */
export function errorFor(field: string | undefined, key: string): boolean {
  return field !== undefined && (field === key || field.startsWith(`${key}.`) || field.startsWith(`${key}[`))
}

const HOST_NEEDS: Record<string, string> = { print: 'printing to PDF', trash: 'the Recycle Bin' }

export function joinWords(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

/** "LibreOffice", "LibreOffice and Ghostscript", "a part of Sparky that’s missing". */
export function needsList(missing: string[]): string {
  const tools = missing.filter((m): m is ToolStatus['id'] => m in TOOL_NAMES)
  const addOns = tools.filter((t) => OPTIONAL_TOOLS.has(t)).map((t) => TOOL_NAMES[t])
  const parts = [...addOns]
  if (tools.some((t) => !OPTIONAL_TOOLS.has(t))) parts.push('a part of Sparky that’s missing')
  for (const m of missing) if (HOST_NEEDS[m]) parts.push(HOST_NEEDS[m])
  return joinWords(parts)
}

/** One plain line for a list row: "Needs LibreOffice". */
export function needsText(missing: string[]): string {
  return `Needs ${needsList(missing)}`
}

const NOUNS: Record<Category, string> = { video: 'videos', audio: 'audio files', image: 'images', document: 'documents', archive: 'archives' }

/** What an op takes, for the file picker: "PDF files", "Images and videos". */
export function acceptsText(accepts: string[]): string | undefined {
  if (!accepts.length) return undefined
  if (accepts.length <= 3) return `${joinWords(accepts.map((e) => e.toUpperCase()))} files`
  const all = accepts.map((e) => categoryOf(e)).filter((c): c is Category => c !== undefined)
  const unique = [...new Set(all)]
  // One stray extension (GIF counts as video) shouldn't make an image tool read "Images and videos".
  const main = unique.filter((c) => all.filter((x) => x === c).length > 1)
  const cats = main.length ? main : unique
  const text = joinWords(cats.map((c) => NOUNS[c]))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const OP_GROUPS: { id: string; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'video', label: CATEGORY_LABELS.video },
  { id: 'audio', label: CATEGORY_LABELS.audio },
  { id: 'image', label: CATEGORY_LABELS.image },
  { id: 'document', label: CATEGORY_LABELS.document },
  { id: 'archive', label: CATEGORY_LABELS.archive },
  { id: 'tool', label: 'More tools' },
]

/** Ops with a page of their own. */
export const OWN_PAGE = new Set(['convert', 'download'])

/** The Tools list: ops grouped in a fixed order, groups this build doesn't name at the end. */
export function groupOps(ops: OpSummary[]): { id: string; label: string; ops: OpSummary[] }[] {
  const shown = ops.filter((o) => !OWN_PAGE.has(o.category))
  const known = OP_GROUPS.map((g) => ({ ...g, ops: shown.filter((o) => o.category === g.id) }))
  const extra = [...new Set(shown.map((o) => o.category))].filter((c) => !OP_GROUPS.some((g) => g.id === c)).map((c) => ({ id: c, label: humanize(c), ops: shown.filter((o) => o.category === c) }))
  return [...known, ...extra].filter((g) => g.ops.length > 0)
}
