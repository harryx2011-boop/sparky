// Help text, generated from the op descriptors and the command registry.
import { secretHelp } from '@sparky/core'
import type { OpDescriptor } from '@sparky/engine'
import { isArraySchema, isBooleanSchema } from './args'
import { ENV_VARS, VERSION } from './env'
import { acceptsText, choiceText, commandName, commandWords, fieldsOf, toolLabel, type FieldInfo } from './fields'

export const GLOBAL_FLAGS: readonly [flag: string, meaning: string][] = [
  ['--json', 'Print the result as JSON on stdout, and no progress bar.'],
  ['--no-wait', 'Queue the job in the open app and return its id without waiting.'],
  ['--local', 'Run in this process even when the Sparky app is open.'],
  ['-h, --help', 'Show help.'],
]

const WIDTH = 92

function wrap(text: string, indent: number, width = WIDTH): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (line && indent + line.length + 1 + w.length > width) {
      lines.push(line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) lines.push(line)
  return lines
}

/** Two columns: a left cell, then wrapped text aligned after it. */
function rows(items: readonly [string, string][], pad = 2): string[] {
  const col = Math.min(30, Math.max(...items.map(([l]) => l.length)) + 2)
  const out: string[] = []
  for (const [left, right] of items) {
    const text = wrap(right, pad + col)
    const head = ' '.repeat(pad) + left
    if (head.length + 2 > pad + col || !text.length) {
      out.push(head)
      for (const t of text) out.push(' '.repeat(pad + col) + t)
    } else {
      out.push(head.padEnd(pad + col) + (text[0] ?? ''))
      for (const t of text.slice(1)) out.push(' '.repeat(pad + col) + t)
    }
  }
  return out
}

function valueHint(f: FieldInfo): string {
  if (isBooleanSchema(f.schema)) return ''
  if (f.secret) return ' -'
  const inner = isArraySchema(f.schema) ? (f.schema.items ?? {}) : f.schema
  const choices = f.choices?.map(String)
  const hint = choices && choices.join('|').length <= 34 ? choices.join('|') : isArraySchema(f.schema) || f.positional ? f.name : ['number', 'integer'].includes(String(inner.type)) ? 'n' : f.name === 'out' ? 'path' : 'value'
  return ` <${hint}>`
}

function fieldText(f: FieldInfo): string {
  const parts = [f.title.endsWith('.') ? f.title : `${f.title}.`]
  if (f.description) parts.push(f.description)
  const choices = choiceText(f)
  if (choices && (f.labels || choices.length > 34)) parts.push(`Choices: ${choices}.`)
  if (isArraySchema(f.schema) && !f.positional) parts.push('Repeat the option for more than one.')
  if (f.default !== undefined) parts.push(`Default: ${String(f.default)}.`)
  if (f.secret) parts.push(secretHelp(`--${f.flag}`, f.name))
  if (f.required && !f.positional) parts.push('Required.')
  return parts.join(' ')
}

/** `sparky pdf merge --help`. */
export function opHelp(op: OpDescriptor): string {
  const fields = fieldsOf(op)
  const pos = fields.filter((f) => f.positional)
  const flags = fields.filter((f) => !f.positional)
  const usage = [commandName(op.id), ...pos.map((f) => (isArraySchema(f.schema) ? `<${f.name}...>` : `<${f.name}>`)), '[options]'].join(' ')
  const lines = [`${op.label}`, '', `Usage: ${usage}`, '']
  lines.push(...wrap(op.accepts.length ? `Takes: ${acceptsText(op, 40)}.` : `Takes: ${acceptsText(op)}.`, 0))
  if (op.arity === 'all') lines.push(`All the ${pos[0]?.name ?? 'inputs'} go into one result.`)
  else lines.push(`Each of the ${pos[0]?.name ?? 'inputs'} is its own job.`)
  if (op.requires.length) lines.push(`Needs: ${op.requires.map(toolLabel).join(', ')}.`)
  if (pos.length) {
    lines.push('', 'Arguments:')
    lines.push(...rows(pos.map((f) => [isArraySchema(f.schema) ? `${f.name}...` : f.name, fieldText(f)])))
  }
  lines.push('', 'Options:')
  const flagRows = flags.map((f): [string, string] => {
    const alias = f.name === 'output' ? ', --to' : ''
    const left = isBooleanSchema(f.schema) ? `--${f.flag}, --no-${f.flag}` : `--${f.flag}${alias}${valueHint(f)}`
    return [left, fieldText(f)]
  })
  lines.push(...rows(flagRows))
  lines.push('', 'Also:')
  lines.push(...rows(GLOBAL_FLAGS))
  return lines.join('\n')
}

/** Ops grouped by the first word of their id: `pdf` → pdf.merge, pdf.split, … */
export function groups(ops: readonly OpDescriptor[]): Map<string, OpDescriptor[]> {
  const out = new Map<string, OpDescriptor[]>()
  for (const op of ops) {
    const [first] = commandWords(op.id)
    const key = op.id.includes('.') ? first! : ''
    out.set(key, [...(out.get(key) ?? []), op])
  }
  return out
}

/** `sparky pdf --help`. */
export function groupHelp(group: string, ops: readonly OpDescriptor[]): string {
  const lines = [`sparky ${group}: ${ops.length} tools`, '', `Usage: sparky ${group} <tool> [files...] [options]`, '', 'Tools:']
  lines.push(...rows(ops.map((o) => [commandWords(o.id).slice(1).join(' '), o.label])))
  lines.push('', `Run "sparky ${group} <tool> --help" for a tool's options.`)
  return lines.join('\n')
}

export interface CommandSummary {
  usage: string
  summary: string
}

/** `sparky --help`. */
export function mainHelp(ops: readonly OpDescriptor[], commands: readonly CommandSummary[]): string {
  const g = groups(ops)
  const lines = [`Sparky ${VERSION}: convert files, run PDF, video and image tools, and download from links, on this PC.`, '', 'Usage: sparky <command> [arguments] [options]', '', 'Tools:']
  const toolRows: [string, string][] = []
  for (const op of g.get('') ?? []) toolRows.push([`${commandWords(op.id).join(' ')}`, op.label])
  for (const [name, list] of g) if (name) toolRows.push([`${name} <tool>`, list.map((o) => commandWords(o.id).slice(1).join(' ')).join(', ')])
  lines.push(...rows(toolRows))
  lines.push('', 'Commands:')
  lines.push(...rows(commands.map((c) => [c.usage, c.summary])))
  lines.push('', 'Options:')
  lines.push(...rows(GLOBAL_FLAGS))
  lines.push('', 'Environment:')
  lines.push(...rows(ENV_VARS))
  lines.push(
    '',
    'Jobs go to the Sparky app when it is open (they show in its Queue), else run in this process.',
    'Exit codes: 0 done, 1 a job failed, 2 wrong usage or input, 3 a needed program is missing, 130 stopped with Ctrl+C.',
    '',
    'Examples:',
    '  sparky convert photo.png --to pdf',
    '  sparky pdf merge a.pdf b.pdf --out merged.pdf',
    '  sparky media edit clip.mp4 --trim-start 5 --trim-end 20',
    '  sparky download https://youtu.be/... --mode audio',
    '  sparky init --client claude-code',
  )
  return lines.join('\n')
}
