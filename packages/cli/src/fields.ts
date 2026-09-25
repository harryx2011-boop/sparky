// What the CLI help and the MCP tool list say about an op and its fields, read from the op descriptor alone.
import type { OpDescriptor } from '@sparky/engine'
import { choicesOf, kebab, type JsonSchema, type ObjectSchema } from './args'

/** Words for the field the engine adds to every op; ops describe their own fields. */
export const OUT_TEXT = {
  title: 'Save to',
  description: 'A file, or a folder (end it with \\ or / when it does not exist yet). Left out: the Sparky output folder.',
}

export interface FieldInfo {
  name: string
  flag: string
  schema: JsonSchema
  required: boolean
  positional: boolean
  secret: boolean
  title: string
  description?: string
  choices?: unknown[]
  labels?: Record<string, string>
  default?: unknown
}

/** `videoKbps` → "Video kbps", for fields the registry gave no title. */
export function humanize(name: string): string {
  const words = kebab(name).split('-').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function opSchema(op: Pick<OpDescriptor, 'inputSchema'>): ObjectSchema {
  return op.inputSchema as ObjectSchema
}

/** Every input field, positional ones first, then required, then the rest in schema order; `out` last. */
export function fieldsOf(op: Pick<OpDescriptor, 'inputSchema' | 'positional' | 'secret'>): FieldInfo[] {
  const schema = opSchema(op)
  const required = new Set(schema.required ?? [])
  const fields = Object.entries(schema.properties ?? {}).map(([name, s]): FieldInfo => {
    const isOut = name === 'out'
    return {
      name,
      flag: kebab(name),
      schema: s,
      required: required.has(name),
      positional: op.positional.includes(name),
      secret: op.secret.includes(name),
      title: s.title ?? (isOut ? OUT_TEXT.title : humanize(name)),
      description: s.description ?? (isOut ? OUT_TEXT.description : undefined),
      choices: choicesOf(s.items && s.type === 'array' ? s.items : s),
      labels: s.labels,
      default: s.default,
    }
  })
  const rank = (f: FieldInfo) => (f.positional ? 0 : f.name === 'out' ? 3 : f.required ? 1 : 2)
  return fields.map((f, i) => [f, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([f]) => f)
}

/** "fit = Fit to picture, a4 = A4" for a pick-one field, or the plain choices when no labels exist. */
export function choiceText(f: Pick<FieldInfo, 'choices' | 'labels'>): string | undefined {
  if (!f.choices?.length) return undefined
  return f.choices.map((c) => (f.labels?.[String(c)] ? `${String(c)} = ${f.labels[String(c)]}` : String(c))).join(', ')
}

/** The words for an op's source: file types, links, or "many types". */
export function acceptsText(op: Pick<OpDescriptor, 'accepts'>, max = 14): string {
  if (!op.accepts.length) return 'web links (URLs)'
  if (op.accepts.length <= max) return op.accepts.join(', ')
  return `${op.accepts.length} file types`
}

/** "pdf.merge" → ["pdf", "merge"]; "convert" → ["convert"]. Underscores read as dashes on the command line. */
export function commandWords(opId: string): string[] {
  return opId.split('.').map((w) => w.replace(/_/g, '-'))
}

export function commandName(opId: string): string {
  return ['sparky', ...commandWords(opId)].join(' ')
}

/** Tool names for agents: sparky_convert, sparky_pdf_merge, … */
export function toolName(opId: string): string {
  return `sparky_${opId.replace(/[.-]/g, '_')}`
}

/** Program names for the CLI and agents; the app's own copy avoids them on purpose. */
export const TOOL_NAMES: Record<string, string> = {
  ffmpeg: 'FFmpeg',
  ffprobe: 'FFprobe',
  'yt-dlp': 'yt-dlp',
  ghostscript: 'Ghostscript',
  libreoffice: 'LibreOffice',
  pandoc: 'Pandoc',
  '7zip': '7-Zip',
  deno: 'Deno',
  print: 'the Sparky app (for printing to PDF)',
  trash: 'the Sparky app (for the Recycle Bin)',
}

export const toolLabel = (id: string) => TOOL_NAMES[id] ?? id
