import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runInit } from '../src/commands/init'
import type { Io } from '../src/commands/types'
import { HARNESSES, mcpEntry, upsertToml } from '../src/harnesses'

let home: string
let lines: string[]
const io: Io = { out: (t) => void lines.push(t), err: (t) => void lines.push(t) }
const env = {}
const read = (...p: string[]) => fs.readFileSync(path.join(home, ...p), 'utf8')

/** An existing config with another server in it, per client. */
const SEED: Record<string, [string[], string]> = {
  'claude-code': [['.claude.json'], '﻿{\n  "numStartups": 3,\n  "mcpServers": {\n    "helix": {\n      "type": "http",\n      "url": "http://localhost:3001/mcp"\n    }\n  }\n}\n'],
  cursor: [['.cursor', 'mcp.json'], '{\n  "mcpServers": {\n    "other": {\n      "command": "other"\n    }\n  }\n}\n'],
  codex: [['.codex', 'config.toml'], 'model = "o4"\n\n[mcp_servers.other]\ncommand = "other"\n'],
  windsurf: [['.codeium', 'windsurf', 'mcp_config.json'], '{"mcpServers":{"other":{"command":"other"}}}'],
}

function seed(id: string) {
  const [rel, text] = SEED[id]!
  const file = path.join(home, ...rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return file
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-init-'))
  lines = []
})
afterEach(() => fs.rmSync(home, { recursive: true, force: true }))

describe('sparky init', () => {
  for (const h of HARNESSES) {
    it(`${h.id}: --dry-run shows the change and writes nothing`, () => {
      const file = seed(h.id)
      const before = fs.readFileSync(file, 'utf8')
      expect(runInit({ clients: [h.id], dryRun: true, home, env, platform: 'win32' }, io)).toBe(0)
      expect(fs.readFileSync(file, 'utf8')).toBe(before)
      const text = lines.join('\n')
      expect(text).toContain(`would update ${file}`)
      expect(text).toMatch(/^\+ .*sparky/m)
      expect(text).toMatch(/^\+ .*"mcp"/m)
      expect(text).toContain('api-token')
    })

    it(`${h.id}: writes the entry beside the others, then reports it is already set up`, () => {
      const file = seed(h.id)
      runInit({ clients: [h.id], dryRun: false, home, env, platform: 'linux' }, io)
      const text = fs.readFileSync(file, 'utf8')
      expect(text).toContain(h.id === 'claude-code' ? 'helix' : 'other')
      if (h.id === 'codex') expect(text).toContain('[mcp_servers.sparky]\ncommand = "sparky"\nargs = ["mcp"]')
      else {
        const json = JSON.parse(text.replace(/^﻿/, '')) as { mcpServers: Record<string, { command: string; args: string[] }> }
        expect(json.mcpServers.sparky).toMatchObject({ command: 'sparky', args: ['mcp'] })
        expect(Object.keys(json.mcpServers).length).toBe(2)
      }
      lines = []
      runInit({ clients: [h.id], dryRun: false, home, env, platform: 'linux' }, io)
      expect(lines[0]).toContain('already set up')
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    })
  }

  it('keeps the BOM and the other keys of ~/.claude.json and prints the claude mcp add line', () => {
    seed('claude-code')
    runInit({ clients: ['claude-code'], dryRun: false, home, env, platform: 'win32' }, io)
    const text = read('.claude.json')
    expect(text.startsWith('﻿')).toBe(true)
    const json = JSON.parse(text.slice(1))
    expect(json.numStartups).toBe(3)
    expect(json.mcpServers.sparky).toEqual({ type: 'stdio', command: 'cmd', args: ['/c', 'sparky', 'mcp'], env: {} })
    expect(lines.join('\n')).toContain('claude mcp add --scope user sparky -- cmd /c sparky mcp')
  })

  it('finds installed clients by their markers when no --client is given', () => {
    fs.mkdirSync(path.join(home, '.cursor'))
    runInit({ clients: [], dryRun: true, home, env }, io)
    expect(lines.join('\n')).toContain('Cursor: would update')
    expect(lines.join('\n')).not.toContain('Codex')
  })

  it('refuses when no client is found or the name is unknown', () => {
    expect(() => runInit({ clients: [], dryRun: true, home, env }, io)).toThrow(/Found no agent client/)
    expect(() => runInit({ clients: ['vim'], dryRun: true, home, env }, io)).toThrow(/Unknown client "vim"/)
  })

  it('--client all sets up every client, even ones not installed', () => {
    runInit({ clients: ['all'], dryRun: false, home, env, platform: 'linux' }, io)
    for (const h of HARNESSES) expect(fs.existsSync(h.configPath(home, env))).toBe(true)
  })

  it('leaves a broken JSON file alone', () => {
    const file = path.join(home, '.cursor', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{ not json')
    expect(() => runInit({ clients: ['cursor'], dryRun: false, home, env }, io)).toThrow(/not valid JSON/)
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not json')
  })

  it('replaces only the sparky table in a TOML file', () => {
    const file = path.join(home, 'config.toml')
    fs.writeFileSync(file, 'a = 1\n\n[mcp_servers.sparky]\ncommand = "old"\nargs = []\n\n[mcp_servers.other]\ncommand = "x"\n')
    const r = upsertToml(file, 'mcp_servers', mcpEntry('linux'))
    expect(r.after).toBe('a = 1\n\n[mcp_servers.sparky]\ncommand = "sparky"\nargs = ["mcp"]\n\n[mcp_servers.other]\ncommand = "x"\n')
  })

  it('keeps a user\'s own keys in an existing sparky entry and changes only command and args', () => {
    const file = path.join(home, '.claude.json')
    fs.writeFileSync(file, JSON.stringify({ mcpServers: { sparky: { type: 'stdio', command: 'old', args: [], env: { SPARKY_LOCAL: '1' }, timeout: 90 } } }, null, 2) + '\n')
    runInit({ clients: ['claude-code'], dryRun: false, home, env, platform: 'linux' }, io)
    expect(JSON.parse(read('.claude.json')).mcpServers.sparky).toEqual({ type: 'stdio', command: 'sparky', args: ['mcp'], env: { SPARKY_LOCAL: '1' }, timeout: 90 })
  })

  it('keeps other keys in an existing codex table, including a multi-line args array', () => {
    const file = path.join(home, 'config.toml')
    fs.writeFileSync(file, '[mcp_servers.sparky]\ncommand = "old"\nargs = [\n  "x",\n]\nstartup_timeout_sec = 30\n\n[mcp_servers.sparky.env]\nSPARKY_LOCAL = "1"\n')
    const r = upsertToml(file, 'mcp_servers', mcpEntry('linux'))
    expect(r.after).toBe('[mcp_servers.sparky]\ncommand = "sparky"\nargs = ["mcp"]\nstartup_timeout_sec = 30\n\n[mcp_servers.sparky.env]\nSPARKY_LOCAL = "1"\n')
  })

  it('stops on a sparky key written inline under [mcp_servers] instead of adding a second one', () => {
    const file = path.join(home, 'config.toml')
    const text = '[mcp_servers]\nsparky = { command = "sparky", args = ["mcp"] }\n'
    fs.writeFileSync(file, text)
    expect(() => upsertToml(file, 'mcp_servers', mcpEntry('linux'))).toThrow(/by hand/)
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
  })

  it('writes through a symlinked config and keeps it a link', (ctx) => {
    const real = path.join(home, 'dotfiles', 'mcp.json')
    fs.mkdirSync(path.dirname(real), { recursive: true })
    fs.writeFileSync(real, '{}\n')
    fs.mkdirSync(path.join(home, '.cursor'))
    const link = path.join(home, '.cursor', 'mcp.json')
    try {
      fs.symlinkSync(real, link, 'file')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EPERM') return ctx.skip()
      throw e
    }
    runInit({ clients: ['cursor'], dryRun: false, home, env, platform: 'linux' }, io)
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
    expect(JSON.parse(fs.readFileSync(real, 'utf8')).mcpServers.sparky.command).toBe('sparky')
  })

  it.skipIf(process.platform === 'win32')('keeps the file mode, and makes a new file private', () => {
    const file = path.join(home, '.cursor', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{}\n')
    fs.chmodSync(file, 0o640)
    runInit({ clients: ['cursor'], dryRun: false, home, env, platform: 'linux' }, io)
    expect(fs.statSync(file).mode & 0o777).toBe(0o640)
    runInit({ clients: ['windsurf'], dryRun: false, home, env, platform: 'linux' }, io)
    expect(fs.statSync(path.join(home, '.codeium', 'windsurf', 'mcp_config.json')).mode & 0o777).toBe(0o600)
  })

  it('follows CODEX_HOME', () => {
    const codex = HARNESSES.find((h) => h.id === 'codex')!
    expect(codex.configPath(home, { CODEX_HOME: path.join(home, 'cx') })).toBe(path.join(home, 'cx', 'config.toml'))
  })
})
