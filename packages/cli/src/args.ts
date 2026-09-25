// The argv parser, and the typing of flags against an op's JSON schema.
import { UsageError } from './errors'

export type RawValue = string | boolean

export interface RawArgs {
  positionals: string[]
  /** Keyed by the name as typed after `--`; each use appends. `--no-x` stores false under `x`. */
  flags: Map<string, RawValue[]>
}

export interface ParseSpec {
  /** Flags that never take the next word as their value. */
  booleans?: ReadonlySet<string>
}

const SHORT: Record<string, string> = { h: 'help', o: 'out' }

function add(flags: Map<string, RawValue[]>, name: string, v: RawValue) {
  const list = flags.get(name)
  if (list) list.push(v)
  else flags.set(name, [v])
}

/**
 * `--flag`, `--flag v`, `--flag=v`, `--no-flag`, repeats → arrays, `--` ends flags.
 * A value may start with a single dash (`--volume -3`); a word starting with `--` never is one.
 */
export function parseArgv(argv: readonly string[], spec: ParseSpec = {}): RawArgs {
  const booleans = spec.booleans ?? new Set<string>()
  const positionals: string[] = []
  const flags = new Map<string, RawValue[]>()
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!
    if (tok === '--') {
      positionals.push(...argv.slice(i + 1))
      break
    }
    if (tok.startsWith('--') && tok.length > 2) {
      const body = tok.slice(2)
      const eq = body.indexOf('=')
      if (eq > 0) {
        add(flags, body.slice(0, eq), body.slice(eq + 1))
        continue
      }
      if (body.startsWith('no-') && body.length > 3 && !booleans.has(body)) {
        add(flags, body.slice(3), false)
        continue
      }
      const next = argv[i + 1]
      if (!booleans.has(body) && next !== undefined && !next.startsWith('--')) {
        add(flags, body, next)
        i++
      } else add(flags, body, true)
      continue
    }
    if (/^-[a-zA-Z]$/.test(tok)) {
      const name = SHORT[tok[1]!] ?? tok[1]!
      const next = argv[i + 1]
      if (!booleans.has(name) && name !== 'help' && next !== undefined && !next.startsWith('-')) {
        add(flags, name, next)
        i++
      } else add(flags, name, true)
      continue
    }
    positionals.push(tok)
  }
  return { positionals, flags }
}

// ── JSON schema typing ──────────────────────────────────────────────────────────────────────────

export interface JsonSchema {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  anyOf?: JsonSchema[]
  items?: JsonSchema
  title?: string
  description?: string
  default?: unknown
  labels?: Record<string, string>
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  minItems?: number
  pattern?: string
  [k: string]: unknown
}

export interface ObjectSchema {
  properties?: Record<string, JsonSchema>
  required?: string[]
}

/** camelCase field → kebab-case flag. */
export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase()
}

const typeOf = (s: JsonSchema) => (Array.isArray(s.type) ? s.type[0] : s.type)

export const isArraySchema = (s: JsonSchema) => typeOf(s) === 'array'

export function isBooleanSchema(s: JsonSchema): boolean {
  if (typeOf(s) === 'boolean') return true
  return Boolean(s.anyOf?.length && s.anyOf.every((b) => typeOf(b) === 'boolean' || b.type === 'null'))
}

/** The values a pick-one field takes, when it is one. */
export function choicesOf(s: JsonSchema): unknown[] | undefined {
  if (s.enum) return s.enum
  if (s.const !== undefined) return [s.const]
  if (s.anyOf?.length && s.anyOf.every((b) => b.const !== undefined || b.enum)) return s.anyOf.flatMap((b) => choicesOf(b) ?? [])
  return undefined
}

const TRUE = new Set(['true', 'yes', 'on', '1'])
const FALSE = new Set(['false', 'no', 'off', '0'])

/** One raw value typed by its schema. `label` names the flag in messages. */
export function coerceValue(v: RawValue, s: JsonSchema, label: string): unknown {
  if (isBooleanSchema(s)) {
    if (typeof v === 'boolean') return v
    const low = v.toLowerCase()
    if (TRUE.has(low)) return true
    if (FALSE.has(low)) return false
    throw new UsageError(`${label} takes true or false, not "${v}".`)
  }
  if (typeof v === 'boolean') {
    if (v === false) throw new UsageError(`${label} is not a yes/no option, so it has no --no- form.`)
    throw new UsageError(`${label} needs a value.`)
  }
  const choices = choicesOf(s)
  if (choices) {
    const hit = choices.find((c) => String(c).toLowerCase() === v.toLowerCase())
    if (hit === undefined) throw new UsageError(`${label} must be one of: ${choices.map(String).join(', ')} (got "${v}").`)
    return hit
  }
  if (s.anyOf?.length) {
    for (const branch of s.anyOf) {
      try {
        return coerceValue(v, branch, label)
      } catch {
        /* next branch */
      }
    }
    throw new UsageError(`${label} can't take "${v}".`)
  }
  switch (typeOf(s)) {
    case 'number':
    case 'integer': {
      const n = Number(v)
      if (v.trim() === '' || !Number.isFinite(n)) throw new UsageError(`${label} takes a number, not "${v}".`)
      if (typeOf(s) === 'integer' && !Number.isInteger(n)) throw new UsageError(`${label} takes a whole number, not "${v}".`)
      return n
    }
    default:
      return v
  }
}

/** Every raw value of an array field: repeats, and commas between numbers (`--sizes 16,32,48`). */
export function coerceArray(values: RawValue[], s: JsonSchema, label: string): unknown[] {
  const item = s.items ?? {}
  const numeric = ['number', 'integer'].includes(typeOf(item) ?? '') || Boolean(choicesOf(item)?.every((c) => typeof c === 'number'))
  const parts = values.flatMap((v) => (numeric && typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [v]))
  return parts.map((p) => coerceValue(p, item, label))
}

export interface BindSpec {
  schema: ObjectSchema
  /** Fields that take bare words, in order; an array field takes every word left. */
  positional: readonly string[]
  /** `--to` → `output`: extra spellings, used only when the target field exists. */
  aliases?: Record<string, string>
  /** Flags the surface keeps for itself (`json`, `wait`, …), typed as booleans. */
  reserved?: readonly string[]
  /** Names the command in messages, e.g. "sparky pdf merge". */
  command: string
}

export interface Bound {
  args: Record<string, unknown>
  /** Reserved flags as given. */
  reserved: Record<string, boolean>
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      // Two letters swapped count as one typo.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
    }
  return d[a.length]![b.length]!
}

/** The closest of `names` to `wrong`, when one is close enough to be a typo. */
export function suggest(wrong: string, names: Iterable<string>): string | undefined {
  let best: string | undefined
  let bestD = Infinity
  for (const n of names) {
    const dd = distance(wrong, n)
    if (dd < bestD) [best, bestD] = [n, dd]
  }
  return best !== undefined && bestD <= Math.max(1, Math.floor(wrong.length / 3)) ? best : undefined
}

/** The flag names a schema's boolean fields and the reserved flags use, for parseArgv. */
export function booleanFlags(spec: Pick<BindSpec, 'schema' | 'reserved'>): Set<string> {
  const out = new Set<string>(spec.reserved ?? [])
  for (const [name, s] of Object.entries(spec.schema.properties ?? {})) if (isBooleanSchema(s)) out.add(kebab(name)).add(name)
  return out
}

/** argv → validated-shape args for an op: flags by kebab or camel name, positionals by `positional`, values typed by the schema. */
export function bindArgs(argv: readonly string[], spec: BindSpec): Bound {
  const props = spec.schema.properties ?? {}
  const raw = parseArgv(argv, { booleans: booleanFlags(spec) })
  const byFlag = new Map<string, string>()
  for (const name of Object.keys(props)) {
    byFlag.set(kebab(name), name)
    byFlag.set(name, name)
  }
  for (const [alias, target] of Object.entries(spec.aliases ?? {})) if (props[target] && !byFlag.has(alias)) byFlag.set(alias, target)
  const reservedNames = new Set(spec.reserved ?? [])
  if (reservedNames.has('help') && raw.flags.get('help')?.at(-1) === true) return { args: {}, reserved: { help: true } }

  const reserved: Record<string, boolean> = {}
  const values = new Map<string, RawValue[]>()
  for (const [flag, vals] of raw.flags) {
    if (reservedNames.has(flag)) {
      const last = vals[vals.length - 1]!
      reserved[flag] = coerceValue(last, { type: 'boolean' }, `--${flag}`) as boolean
      continue
    }
    const field = byFlag.get(flag)
    if (!field) {
      const near = suggest(flag, [...[...byFlag.keys()].filter((k) => k === kebab(k)), ...reservedNames])
      throw new UsageError(`Unknown option --${flag} for "${spec.command}".${near ? ` Did you mean --${near}?` : ''} Run "${spec.command} --help".`)
    }
    const list = values.get(field) ?? []
    values.set(field, [...list, ...vals])
  }

  // Bare words fill the positional fields in order; an array field takes the rest.
  const words = [...raw.positionals]
  for (const field of spec.positional) {
    const s = props[field]
    if (!s || !words.length) continue
    const take = isArraySchema(s) ? words.splice(0) : words.splice(0, 1)
    values.set(field, [...take, ...(values.get(field) ?? [])])
  }
  if (words.length) {
    throw new UsageError(`"${spec.command}" doesn't take "${words[0]}" here.${spec.positional.length ? '' : ' It takes options only.'} Run "${spec.command} --help".`)
  }

  const args: Record<string, unknown> = {}
  for (const [field, vals] of values) {
    const s = props[field]!
    const label = `--${kebab(field)}`
    if (isArraySchema(s)) args[field] = coerceArray(vals, s, label)
    else if (vals.length > 1) throw new UsageError(`${label} was given ${vals.length} times; it takes one value.`)
    else args[field] = coerceValue(vals[0]!, s, label)
  }
  return { args, reserved }
}

/** Required fields the args don't have, as flags (`--output`) or argument names (`<files>`). */
export function missingRequired(args: Record<string, unknown>, spec: Pick<BindSpec, 'schema' | 'positional'>): string[] {
  return (spec.schema.required ?? [])
    .filter((f) => args[f] === undefined || (Array.isArray(args[f]) && (args[f] as unknown[]).length === 0))
    .map((f) => (spec.positional.includes(f) ? `<${f}>` : `--${kebab(f)}`))
}
