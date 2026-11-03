// The agent clients Sparky can add itself to: one object each, found by its markers, written without touching other entries.
import { configInlineEntryError, configInlineEnvError, configNotJsonError, configNotObjectError, unknownAgentClientError } from '@sparky/core'
import fs from 'node:fs'
import path from 'node:path'

export const SERVER_NAME = 'sparky'

export interface McpEntry {
  command: string
  args: string[]
  env?: Record<string, string>
}

export function mcpEntry(platform: NodeJS.Platform = process.platform): McpEntry {
  return platform === 'win32' ? { command: 'cmd', args: ['/c', 'sparky', 'mcp'] } : { command: 'sparky', args: ['mcp'] }
}

export interface WriteResult {
  file: string
  before: string
  after: string
  changed: boolean
}

export type HarnessEnv = Record<string, string | undefined>

export type HarnessErrorCode = 'unknown_client' | 'invalid_config'

export class HarnessError extends Error {
  constructor(
    public readonly code: HarnessErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'HarnessError'
  }
}

export interface Harness {
  id: string
  label: string
  markers(home: string, env: HarnessEnv): string[]
  configPath(home: string, env: HarnessEnv): string
  plan(home: string, env: HarnessEnv, entry: McpEntry): WriteResult
  listed(home: string, env: HarnessEnv): boolean
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

function readQuiet(file: string): string {
  try {
    return readText(file)
  } catch {
    return ''
  }
}

export function applyWrite(r: WriteResult): void {
  if (!r.changed) return
  const target = fs.existsSync(r.file) ? fs.realpathSync(r.file) : r.file
  const mode = fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o600
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const tmp = `${target}.sparky-${process.pid}.tmp`
  try {
    fs.writeFileSync(tmp, r.after, { mode })
    fs.chmodSync(tmp, mode)
    fs.renameSync(tmp, target)
  } catch (e) {
    fs.rmSync(tmp, { force: true })
    throw e
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const hasKeys = (v: unknown): v is Record<string, unknown> => isObject(v) && Object.keys(v).length > 0

export function upsertJson(file: string, key: string, value: Record<string, unknown>): WriteResult {
  const before = readText(file)
  const bom = before.startsWith(BOM)
  const body = bom ? before.slice(1) : before
  let data: Record<string, unknown>
  try {
    data = body.trim() ? (JSON.parse(body) as Record<string, unknown>) : {}
  } catch {
    throw new HarnessError('invalid_config', configNotJsonError(file, SERVER_NAME))
  }
  if (!isObject(data)) throw new HarnessError('invalid_config', configNotObjectError(file))
  const servers = (data[key] && typeof data[key] === 'object' ? data[key] : {}) as Record<string, unknown>
  const old = servers[SERVER_NAME]
  const merged = isObject(old)
    ? { ...old, command: value.command, args: value.args, ...(hasKeys(value.env) ? { env: { ...(isObject(old.env) ? old.env : {}), ...value.env } } : {}) }
    : value
  if (JSON.stringify(old) === JSON.stringify(merged)) return { file, before, after: before, changed: false }
  const next = { ...data, [key]: { ...servers, [SERVER_NAME]: merged } }
  const eol = before.includes('\r\n') ? '\r\n' : '\n'
  let text = JSON.stringify(next, null, 2)
  if (eol === '\r\n') text = text.replace(/\n/g, '\r\n')
  const after = (bom ? BOM : '') + text + (!before || /\r?\n$/.test(before) ? eol : '')
  return { file, before, after, changed: true }
}

function jsonListed(file: string, key: string): boolean {
  try {
    const data = JSON.parse(readQuiet(file).replace(/^﻿/, '') || '{}') as Record<string, unknown>
    const servers = data?.[key] as Record<string, unknown> | undefined
    return isObject(servers) && isObject(servers[SERVER_NAME])
  } catch {
    return false
  }
}

const tomlString = (s: string) => JSON.stringify(s)
const escapeKey = (s: string) => s.replace(/\./g, '\\.')

const tableHeader = (name: string) => new RegExp(`^\\s*\\[\\s*${name}\\s*\\]\\s*(#.*)?$`)
const isHeader = (l: string) => /^\s*\[/.test(l)
const sparkyName = `(?:${SERVER_NAME}|"${SERVER_NAME}")`
const sparkyTable = (esc: string) => tableHeader(`${esc}\\.${sparkyName}`)
const sparkyEnvTable = (esc: string) => tableHeader(`${esc}\\.${sparkyName}\\.(?:env|"env")`)

function openBrackets(l: string): number {
  const bare = l.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '').replace(/#.*/, '')
  return (bare.match(/\[/g)?.length ?? 0) - (bare.match(/\]/g)?.length ?? 0)
}

function definedElsewhere(lines: string[], table: string): number {
  const esc = escapeKey(table)
  const underParent = new RegExp(`^\\s*"?${SERVER_NAME}"?\\s*[.=]`)
  const rootDotted = new RegExp(`^\\s*${esc}\\s*\\.\\s*("?)${SERVER_NAME}\\1\\s*[.=]`)
  for (let i = 0; i < lines.length && !isHeader(lines[i]!); i++) if (rootDotted.test(lines[i]!)) return i
  const parent = lines.findIndex((l) => tableHeader(esc).test(l))
  if (parent < 0) return -1
  for (let i = parent + 1; i < lines.length && !isHeader(lines[i]!); i++) if (underParent.test(lines[i]!)) return i
  return -1
}

function upsertEnvTable(lines: string[], table: string, pairs: [string, string][]): string[] {
  const esc = escapeKey(table)
  const line = (k: string, v: string) => `${k} = ${tomlString(v)}`
  const next = [...lines]
  const head = next.findIndex((l) => sparkyEnvTable(esc).test(l))
  if (head < 0) {
    const start = next.findIndex((l) => sparkyTable(esc).test(l))
    let end = start + 1
    while (end < next.length && !isHeader(next[end]!)) end++
    let at = end
    while (at > start + 1 && next[at - 1]!.trim() === '') at--
    next.splice(at, 0, '', `[${table}.${SERVER_NAME}.env]`, ...pairs.map(([k, v]) => line(k, v)))
    return next
  }
  let end = head + 1
  while (end < next.length && !isHeader(next[end]!)) end++
  const missing: string[] = []
  for (const [k, v] of pairs) {
    const key = new RegExp(`^\\s*"?${k}"?\\s*=`)
    const i = next.slice(head + 1, end).findIndex((l) => key.test(l))
    if (i >= 0) next[head + 1 + i] = line(k, v)
    else missing.push(line(k, v))
  }
  let at = end
  while (at > head + 1 && next[at - 1]!.trim() === '') at--
  next.splice(at, 0, ...missing)
  return next
}

export function upsertToml(file: string, table: string, entry: McpEntry): WriteResult {
  const before = readText(file)
  const eol = before.includes('\r\n') ? '\r\n' : '\n'
  const cmd = `command = ${tomlString(entry.command)}`
  const argList = `[${entry.args.map(tomlString).join(', ')}]`
  const args = `args = ${argList}`
  const pairs = Object.entries(entry.env ?? {})
  const lines = before ? before.split(/\r?\n/) : []
  const esc = escapeKey(table)

  if (definedElsewhere(lines, table) >= 0) {
    throw new HarnessError('invalid_config', configInlineEntryError(file, SERVER_NAME, table, tomlString(entry.command), argList))
  }

  const start = lines.findIndex((l) => sparkyTable(esc).test(l))
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
      } else {
        if (pairs.length && /^\s*"?env"?\s*[.=]/.test(l)) throw new HarnessError('invalid_config', configInlineEnvError(file, `${table}.${SERVER_NAME}`))
        body.push(l)
      }
    }
    const head = [...(hasCmd ? [] : [cmd]), ...(hasArgs ? [] : [args])]
    next = [...lines.slice(0, start + 1), ...head, ...body, ...lines.slice(end)]
  } else {
    const trimmed = [...lines]
    while (trimmed.length && trimmed[trimmed.length - 1]!.trim() === '') trimmed.pop()
    next = [...trimmed, ...(trimmed.length ? [''] : []), `[${table}.${SERVER_NAME}]`, cmd, args, '']
  }
  if (pairs.length) next = upsertEnvTable(next, table, pairs)
  const after = next.join(eol)
  return { file, before, after, changed: after !== before }
}

function tomlListed(file: string, table: string): boolean {
  const lines = readQuiet(file).split(/\r?\n/)
  return lines.some((l) => sparkyTable(escapeKey(table)).test(l)) || definedElsewhere(lines, table) >= 0
}

const jsonHarness = (
  id: string,
  label: string,
  markers: Harness['markers'],
  configPath: Harness['configPath'],
  shape: (e: McpEntry) => Record<string, unknown>,
  equivalent?: Harness['equivalent'],
): Harness => ({
  id,
  label,
  markers,
  configPath,
  plan(home, env, entry) {
    return upsertJson(this.configPath(home, env), 'mcpServers', shape(entry))
  },
  listed(home, env) {
    return jsonListed(this.configPath(home, env), 'mcpServers')
  },
  equivalent,
})

const plainShape = (e: McpEntry) => ({ command: e.command, args: e.args, ...(hasKeys(e.env) ? { env: e.env } : {}) })
const envDir = (env: HarnessEnv, name: string) => env[name]?.trim() || undefined

export const HARNESSES: readonly Harness[] = [
  jsonHarness(
    'claude-code',
    'Claude Code',
    (home, env) => [path.join(home, '.claude'), path.join(home, '.claude.json'), ...(envDir(env, 'CLAUDE_CONFIG_DIR') ? [envDir(env, 'CLAUDE_CONFIG_DIR')!] : [])],
    (home, env) => path.join(envDir(env, 'CLAUDE_CONFIG_DIR') ?? home, '.claude.json'),
    (e) => ({ type: 'stdio', command: e.command, args: e.args, env: { ...e.env } }),
    (e) => `claude mcp add --scope user ${SERVER_NAME} -- ${[e.command, ...e.args].join(' ')}`,
  ),
  jsonHarness('cursor', 'Cursor', (home) => [path.join(home, '.cursor')], (home) => path.join(home, '.cursor', 'mcp.json'), plainShape),
  {
    id: 'codex',
    label: 'Codex',
    markers: (home, env) => [path.join(home, '.codex'), ...(envDir(env, 'CODEX_HOME') ? [envDir(env, 'CODEX_HOME')!] : [])],
    configPath: (home, env) => path.join(envDir(env, 'CODEX_HOME') ?? path.join(home, '.codex'), 'config.toml'),
    plan(home, env, entry) {
      return upsertToml(this.configPath(home, env), 'mcp_servers', entry)
    },
    listed(home, env) {
      return tomlListed(this.configPath(home, env), 'mcp_servers')
    },
    equivalent: (e) => `codex mcp add ${SERVER_NAME} -- ${[e.command, ...e.args].join(' ')}`,
  },
  jsonHarness('windsurf', 'Windsurf', (home) => [path.join(home, '.codeium', 'windsurf')], (home) => path.join(home, '.codeium', 'windsurf', 'mcp_config.json'), plainShape),
]

export function harnessById(id: string): Harness | undefined {
  return HARNESSES.find((h) => h.id === id)
}

export interface HarnessStatus {
  id: string
  label: string
  found: boolean
  installed: boolean
  current: boolean
  configPath: string
}

export function detectHarnesses(home: string, env: HarnessEnv = process.env, entry?: McpEntry | null): HarnessStatus[] {
  return HARNESSES.map((h) => {
    const installed = h.listed(home, env)
    let current = installed
    if (installed && entry) {
      try {
        current = !h.plan(home, env, entry).changed
      } catch {
        current = false
      }
    }
    return {
      id: h.id,
      label: h.label,
      found: h.markers(home, env).some((m) => fs.existsSync(m)),
      installed,
      current,
      configPath: h.configPath(home, env),
    }
  })
}

export interface InstallOptions extends McpEntry {
  home: string
  vars?: HarnessEnv
  dryRun?: boolean
}

export interface InstallResult extends WriteResult {
  id: string
  label: string
}

export function installHarness(id: string, opts: InstallOptions): InstallResult {
  const h = harnessById(id)
  if (!h) throw new HarnessError('unknown_client', unknownAgentClientError(id, HARNESSES.map((x) => x.id)))
  const { home, vars, dryRun, ...entry } = opts
  const r = h.plan(home, vars ?? process.env, entry)
  if (!dryRun) applyWrite(r)
  return { ...r, id: h.id, label: h.label }
}

export function configDiff(r: WriteResult): string {
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
