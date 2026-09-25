// The agent clients `sparky init` can set up: one object each, found by its markers, written without touching other entries.
import fs from 'node:fs'
import path from 'node:path'
import { CliError } from './errors'

export const SERVER_NAME = 'sparky'

export interface McpEntry {
  command: string
  args: string[]
}

/**
 * How a client should start `sparky mcp`. On Windows `sparky` is a .cmd shim, which a client spawning
 * without a shell can't start, so the entry goes through cmd /c (what Claude Code's docs ask for npx too).
 */
export function mcpEntry(platform: NodeJS.Platform = process.platform): McpEntry {
  return platform === 'win32' ? { command: 'cmd', args: ['/c', 'sparky', 'mcp'] } : { command: 'sparky', args: ['mcp'] }
}

export interface WriteResult {
  file: string
  before: string
  after: string
  changed: boolean
}

type Env = Record<string, string | undefined>

export interface Harness {
  id: string
  label: string
  /** Paths under home whose presence means the client is installed. */
  markers: string[]
  configPath(home: string, env: Env): string
  /** Plans the file's new text; `apply` writes it. */
  plan(home: string, env: Env, entry: McpEntry): WriteResult
  /** A line the user could run instead, when the client has its own command for it. */
  equivalent?(entry: McpEntry): string
}

const BOM = '﻿'

function readText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw e
  }
}

/** Writes through a temp file and a rename, so a client reading the file never sees half of it. */
export function apply(r: WriteResult): void {
  if (!r.changed) return
  // A symlinked config (dotfiles) is written where it points, so the link survives; the file keeps its mode.
  const target = fs.existsSync(r.file) ? fs.realpathSync(r.file) : r.file
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.sparky-${process.pid}.tmp`
  fs.writeFileSync(tmp, r.after, { mode })
  fs.chmodSync(tmp, mode)
  fs.renameSync(tmp, target)
}

/** Sets `<key>.sparky` in a JSON file, keeping every other key, the BOM and the trailing newline as they were. */
export function upsertJson(file: string, key: string, value: Record<string, unknown>): WriteResult {
  const before = readText(file)
  const bom = before.startsWith(BOM)
  const body = bom ? before.slice(1) : before
  let data: Record<string, unknown>
  try {
    data = body.trim() ? (JSON.parse(body) as Record<string, unknown>) : {}
  } catch {
    throw new CliError(`${file} is not valid JSON, so Sparky left it alone. Fix it, or add the "${SERVER_NAME}" server by hand.`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new CliError(`${file} does not hold a JSON object, so Sparky left it alone.`)
  const servers = (data[key] && typeof data[key] === 'object' ? data[key] : {}) as Record<string, unknown>
  const old = servers[SERVER_NAME]
  // An existing entry keeps the user's own keys (env, timeouts); only how to start Sparky is ours.
  const merged = old && typeof old === 'object' && !Array.isArray(old) ? { ...(old as Record<string, unknown>), command: value.command, args: value.args } : value
  if (JSON.stringify(old) === JSON.stringify(merged)) return { file, before, after: before, changed: false }
  const next = { ...data, [key]: { ...servers, [SERVER_NAME]: merged } }
  const eol = before.includes('\r\n') ? '\r\n' : '\n'
  let text = JSON.stringify(next, null, 2)
  if (eol === '\r\n') text = text.replace(/\n/g, '\r\n')
  const after = (bom ? BOM : '') + text + (!before || /\r?\n$/.test(before) ? eol : '')
  return { file, before, after, changed: true }
}

const tomlString = (s: string) => JSON.stringify(s)

const tableHeader = (name: string) => new RegExp(`^\\s*\\[\\s*${name}\\s*\\]\\s*(#.*)?$`)
const isHeader = (l: string) => /^\s*\[/.test(l)

/** How far '[' outnumbers ']' outside strings, for a value that runs over several lines. */
function openBrackets(l: string): number {
  const bare = l.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '').replace(/#.*/, '')
  return (bare.match(/\[/g)?.length ?? 0) - (bare.match(/\]/g)?.length ?? 0)
}

/**
 * Sets `command` and `args` in the `[<table>.sparky]` table of a TOML file, keeping its other keys and sub-tables.
 * A `sparky = { … }` written inline under `[<table>]` is left alone: two definitions would make the file invalid.
 */
export function upsertToml(file: string, table: string, entry: McpEntry): WriteResult {
  const before = readText(file)
  const eol = before.includes('\r\n') ? '\r\n' : '\n'
  const cmd = `command = ${tomlString(entry.command)}`
  const args = `args = [${entry.args.map(tomlString).join(', ')}]`
  const lines = before ? before.split(/\r?\n/) : []
  const esc = table.replace(/\./g, '\\.')

  const parent = lines.findIndex((l) => tableHeader(esc).test(l))
  if (parent >= 0) {
    const inline = new RegExp(`^\\s*"?${SERVER_NAME}"?\\s*=`)
    for (let i = parent + 1; i < lines.length && !isHeader(lines[i]!); i++) {
      if (inline.test(lines[i]!)) {
        throw new CliError(`${file} already defines "${SERVER_NAME}" inline under [${table}], so Sparky left it alone. Set its command to ${tomlString(entry.command)} and args to [${entry.args.map(tomlString).join(', ')}] by hand.`)
      }
    }
  }

  const start = lines.findIndex((l) => tableHeader(`${esc}\\.(?:${SERVER_NAME}|"${SERVER_NAME}")`).test(l))
  let next: string[]
  if (start >= 0) {
    let end = start + 1
    while (end < lines.length && !isHeader(lines[end]!)) end++
    const body: string[] = []
    let hasCmd = false
    let hasArgs = false
    for (let i = start + 1; i < end; i++) {
      const l = lines[i]!
      if (/^\s*command\s*=/.test(l)) {
        body.push(cmd)
        hasCmd = true
      } else if (/^\s*args\s*=/.test(l)) {
        body.push(args)
        hasArgs = true
        for (let depth = openBrackets(l); depth > 0 && i + 1 < end; ) depth += openBrackets(lines[++i]!)
      } else body.push(l)
    }
    const head = [...(hasCmd ? [] : [cmd]), ...(hasArgs ? [] : [args])]
    next = [...lines.slice(0, start + 1), ...head, ...body, ...lines.slice(end)]
  } else {
    const trimmed = [...lines]
    while (trimmed.length && trimmed[trimmed.length - 1]!.trim() === '') trimmed.pop()
    next = [...trimmed, ...(trimmed.length ? [''] : []), `[${table}.${SERVER_NAME}]`, cmd, args, '']
  }
  const after = next.join(eol)
  return { file, before, after, changed: after !== before }
}

const jsonHarness = (id: string, label: string, markers: string[], rel: string[], shape: (e: McpEntry) => Record<string, unknown>, equivalent?: Harness['equivalent']): Harness => ({
  id,
  label,
  markers,
  configPath: (home) => path.join(home, ...rel),
  plan(home, env, entry) {
    return upsertJson(this.configPath(home, env), 'mcpServers', shape(entry))
  },
  equivalent,
})

export const HARNESSES: readonly Harness[] = [
  jsonHarness(
    'claude-code',
    'Claude Code',
    ['.claude', '.claude.json'],
    ['.claude.json'],
    (e) => ({ type: 'stdio', command: e.command, args: e.args, env: {} }),
    (e) => `claude mcp add --scope user ${SERVER_NAME} -- ${[e.command, ...e.args].join(' ')}`,
  ),
  jsonHarness('cursor', 'Cursor', ['.cursor'], ['.cursor', 'mcp.json'], (e) => ({ command: e.command, args: e.args })),
  {
    id: 'codex',
    label: 'Codex',
    markers: ['.codex'],
    configPath: (home, env) => path.join(env.CODEX_HOME?.trim() || path.join(home, '.codex'), 'config.toml'),
    plan(home, env, entry) {
      return upsertToml(this.configPath(home, env), 'mcp_servers', entry)
    },
    equivalent: (e) => `codex mcp add ${SERVER_NAME} -- ${[e.command, ...e.args].join(' ')}`,
  },
  jsonHarness('windsurf', 'Windsurf', [path.join('.codeium', 'windsurf')], ['.codeium', 'windsurf', 'mcp_config.json'], (e) => ({ command: e.command, args: e.args })),
]

export function harnessById(id: string): Harness | undefined {
  return HARNESSES.find((h) => h.id === id)
}

export function detectHarnesses(home: string): Harness[] {
  return HARNESSES.filter((h) => h.markers.some((m) => fs.existsSync(path.join(home, m))))
}

/** The changed lines with two lines of context: common head and tail trimmed, the middle shown as -/+. */
export function diff(r: WriteResult): string {
  const a = r.before.replace(/^﻿/, '').split(/\r?\n/)
  const b = r.after.replace(/^﻿/, '').split(/\r?\n/)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const ctx = 2
  const out = [`--- ${r.file}`, `+++ ${r.file}`, `@@ line ${Math.max(1, head - ctx + 1)} @@`]
  for (const l of a.slice(Math.max(0, head - ctx), head)) out.push(`  ${l}`)
  for (const l of a.slice(head, a.length - tail)) out.push(`- ${l}`)
  for (const l of b.slice(head, b.length - tail)) out.push(`+ ${l}`)
  for (const l of a.slice(a.length - tail, Math.min(a.length, a.length - tail + ctx))) out.push(`  ${l}`)
  return out.join('\n')
}
