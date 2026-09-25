// The shared agent-client registry: detection and install against a temp home, for all four clients.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyWrite, detectHarnesses, HARNESSES, HarnessError, installHarness, mcpEntry, upsertToml } from '../../src/agents/harnesses'

let home: string
const env = {}
const WIN_ABS = { command: 'cmd', args: ['/c', 'C:\\Users\\Jo Smith\\AppData\\Local\\Programs\\Sparky\\resources\\cli\\sparky.cmd', 'mcp'] }

/** An existing config with another server in it, per client. */
const SEED: Record<string, [string[], string]> = {
  'claude-code': [['.claude.json'], '\uFEFF{\n  "numStartups": 3,\n  "mcpServers": {\n    "helix": {\n      "type": "http",\n      "url": "http://localhost:3001/mcp"\n    }\n  }\n}\n'],
  cursor: [['.cursor', 'mcp.json'], '{\n  "mcpServers": {\n    "other": {\n      "command": "other"\n    }\n  }\n}\n'],
  codex: [['.codex', 'config.toml'], 'model = "o4"\n\n[mcp_servers.other]\ncommand = "other"\n'],
  windsurf: [['.codeium', 'windsurf', 'mcp_config.json'], '{"mcpServers":{"other":{"command":"other"}}}'],
}

function seed(id: string): string {
  const [rel, text] = SEED[id]!
  const file = path.join(home, ...rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return file
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-agents-'))
})
afterEach(() => fs.rmSync(home, { recursive: true, force: true }))

describe('detectHarnesses', () => {
  it('lists every client, none found in an empty home', () => {
    const all = detectHarnesses(home, env)
    expect(all.map((c) => c.id)).toEqual(['claude-code', 'cursor', 'codex', 'windsurf'])
    expect(all.every((c) => !c.found && !c.installed)).toBe(true)
    expect(all.find((c) => c.id === 'cursor')!.configPath).toBe(path.join(home, '.cursor', 'mcp.json'))
  })

  for (const h of HARNESSES) {
    it(`${h.id}: found by its marker, installed only once the entry is written`, () => {
      seed(h.id)
      const before = detectHarnesses(home, env).find((c) => c.id === h.id)!
      expect(before).toMatchObject({ found: true, installed: false, label: h.label })
      installHarness(h.id, { home, vars: env, ...mcpEntry('win32') })
      expect(detectHarnesses(home, env).find((c) => c.id === h.id)).toMatchObject({ found: true, installed: true })
    })
  }

  it('reports a broken config as not installed instead of throwing', () => {
    fs.mkdirSync(path.join(home, '.cursor'))
    fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), '{ not json')
    expect(detectHarnesses(home, env).find((c) => c.id === 'cursor')).toMatchObject({ found: true, installed: false })
  })

  it('counts a codex entry written inline as installed', () => {
    fs.mkdirSync(path.join(home, '.codex'))
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers]\nsparky = { command = "sparky", args = ["mcp"] }\n')
    expect(detectHarnesses(home, env).find((c) => c.id === 'codex')!.installed).toBe(true)
  })

  it('follows CODEX_HOME', () => {
    const cx = path.join(home, 'cx')
    expect(detectHarnesses(home, { CODEX_HOME: cx }).find((c) => c.id === 'codex')!.configPath).toBe(path.join(cx, 'config.toml'))
  })
})

describe('installHarness', () => {
  for (const h of HARNESSES) {
    it(`${h.id}: writes the entry beside the others, then reports no change`, () => {
      const file = seed(h.id)
      const r = installHarness(h.id, { home, vars: env, ...WIN_ABS })
      expect(r).toMatchObject({ id: h.id, label: h.label, file, changed: true })
      const text = fs.readFileSync(file, 'utf8')
      expect(text).toContain(h.id === 'claude-code' ? 'helix' : 'other')
      if (h.id === 'codex') {
        expect(text).toContain('[mcp_servers.sparky]\ncommand = "cmd"\nargs = ["/c", "C:\\\\Users\\\\Jo Smith\\\\AppData\\\\Local\\\\Programs\\\\Sparky\\\\resources\\\\cli\\\\sparky.cmd", "mcp"]')
      } else {
        const json = JSON.parse(text.replace(/^\uFEFF/, '')) as { mcpServers: Record<string, { command: string; args: string[] }> }
        expect(json.mcpServers.sparky).toMatchObject(WIN_ABS)
        expect(Object.keys(json.mcpServers).length).toBe(2)
      }
      expect(installHarness(h.id, { home, vars: env, ...WIN_ABS }).changed).toBe(false)
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    })

    it(`${h.id}: dryRun plans without writing`, () => {
      const file = seed(h.id)
      const before = fs.readFileSync(file, 'utf8')
      const r = installHarness(h.id, { home, vars: env, ...mcpEntry('linux'), dryRun: true })
      expect(r.changed).toBe(true)
      expect(r.after).toContain('sparky')
      expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })
  }

  it('creates a missing config file with only the sparky entry', () => {
    const r = installHarness('windsurf', { home, vars: env, ...mcpEntry('linux') })
    expect(JSON.parse(fs.readFileSync(r.file, 'utf8'))).toEqual({ mcpServers: { sparky: { command: 'sparky', args: ['mcp'] } } })
  })

  it('keeps the BOM and the other keys of ~/.claude.json', () => {
    seed('claude-code')
    installHarness('claude-code', { home, vars: env, ...mcpEntry('win32') })
    const text = fs.readFileSync(path.join(home, '.claude.json'), 'utf8')
    expect(text.startsWith('\uFEFF')).toBe(true)
    const json = JSON.parse(text.slice(1))
    expect(json.numStartups).toBe(3)
    expect(json.mcpServers.sparky).toEqual({ type: 'stdio', command: 'cmd', args: ['/c', 'sparky', 'mcp'], env: {} })
  })

  it('merges only command and args into an existing entry', () => {
    const file = path.join(home, '.claude.json')
    fs.writeFileSync(file, JSON.stringify({ mcpServers: { sparky: { type: 'stdio', command: 'old', args: [], env: { SPARKY_LOCAL: '1' }, timeout: 90 } } }, null, 2) + '\n')
    installHarness('claude-code', { home, vars: env, ...mcpEntry('linux') })
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers.sparky).toEqual({ type: 'stdio', command: 'sparky', args: ['mcp'], env: { SPARKY_LOCAL: '1' }, timeout: 90 })
  })

  it('keeps CRLF line endings', () => {
    const file = path.join(home, '.cursor', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{\r\n  "mcpServers": {}\r\n}\r\n')
    installHarness('cursor', { home, vars: env, ...mcpEntry('linux') })
    const text = fs.readFileSync(file, 'utf8')
    expect(text.endsWith('}\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('keeps other keys in an existing codex table, including a multi-line args array', () => {
    const file = path.join(home, 'config.toml')
    fs.writeFileSync(file, '[mcp_servers.sparky]\ncommand = "old"\nargs = [\n  "x",\n]\nstartup_timeout_sec = 30\n\n[mcp_servers.sparky.env]\nSPARKY_LOCAL = "1"\n')
    expect(upsertToml(file, 'mcp_servers', mcpEntry('linux')).after).toBe('[mcp_servers.sparky]\ncommand = "sparky"\nargs = ["mcp"]\nstartup_timeout_sec = 30\n\n[mcp_servers.sparky.env]\nSPARKY_LOCAL = "1"\n')
  })

  it('refuses a codex entry written inline and leaves the file alone', () => {
    const file = path.join(home, '.codex', 'config.toml')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const text = '[mcp_servers]\nsparky = { command = "sparky", args = ["mcp"] }\n'
    fs.writeFileSync(file, text)
    let err: unknown
    try {
      installHarness('codex', { home, vars: env, ...mcpEntry('linux') })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(HarnessError)
    expect((err as HarnessError).code).toBe('invalid_config')
    expect((err as Error).message).toMatch(/inline or with dotted keys for \[mcp_servers\].*by hand/)
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
  })

  it('refuses broken JSON and a non-object JSON file, leaving both alone', () => {
    const file = path.join(home, '.cursor', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{ not json')
    expect(() => installHarness('cursor', { home, vars: env, ...mcpEntry('linux') })).toThrow(/not valid JSON/)
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not json')
    fs.writeFileSync(file, '[1, 2]')
    expect(() => installHarness('cursor', { home, vars: env, ...mcpEntry('linux') })).toThrow(/does not hold a JSON object/)
    expect(fs.readFileSync(file, 'utf8')).toBe('[1, 2]')
  })

  it('refuses an unknown client', () => {
    expect(() => installHarness('vim', { home, vars: env, ...mcpEntry('linux') })).toThrow(HarnessError)
    expect(() => installHarness('vim', { home, vars: env, ...mcpEntry('linux') })).toThrow(/claude-code, cursor, codex, windsurf/)
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
    installHarness('cursor', { home, vars: env, ...mcpEntry('linux') })
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
    expect(JSON.parse(fs.readFileSync(real, 'utf8')).mcpServers.sparky.command).toBe('sparky')
  })

  it.skipIf(process.platform === 'win32')('keeps the file mode, and makes a new file private', () => {
    const file = path.join(home, '.cursor', 'mcp.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{}\n')
    fs.chmodSync(file, 0o640)
    installHarness('cursor', { home, vars: env, ...mcpEntry('linux') })
    expect(fs.statSync(file).mode & 0o777).toBe(0o640)
    const r = installHarness('windsurf', { home, vars: env, ...mcpEntry('linux') })
    expect(fs.statSync(r.file).mode & 0o777).toBe(0o600)
  })
})

const EXE_ENTRY = {
  command: 'C:\\Programs\\Sparky\\Sparky.exe',
  args: ['--require', 'C:\\Programs\\Sparky\\resources\\cli\\lib\\esm-resolve.cjs', 'C:\\Programs\\Sparky\\resources\\cli\\lib\\sparky.js', 'mcp'],
  env: {
    ELECTRON_RUN_AS_NODE: '1',
    NODE_PATH: 'C:\\Programs\\Sparky\\resources\\app.asar.unpacked\\node_modules;C:\\Programs\\Sparky\\resources\\app.asar\\node_modules',
    SPARKY_BIN_DIR: 'C:\\Programs\\Sparky\\resources\\bin',
  },
}

describe('current: the stored entry matches what this PC would write', () => {
  for (const h of HARNESSES) {
    it(`${h.id}: a stale command is installed but not current; reinstalling makes it current`, () => {
      seed(h.id)
      installHarness(h.id, { home, vars: env, ...WIN_ABS })
      expect(detectHarnesses(home, env, EXE_ENTRY).find((c) => c.id === h.id)).toMatchObject({ installed: true, current: false })
      expect(detectHarnesses(home, env, WIN_ABS).find((c) => c.id === h.id)).toMatchObject({ installed: true, current: true })
      installHarness(h.id, { home, vars: env, ...EXE_ENTRY })
      expect(detectHarnesses(home, env, EXE_ENTRY).find((c) => c.id === h.id)).toMatchObject({ installed: true, current: true })
    })

    it(`${h.id}: writes env, and a changed env value is not current`, () => {
      seed(h.id)
      const r = installHarness(h.id, { home, vars: env, ...EXE_ENTRY })
      const text = fs.readFileSync(r.file, 'utf8')
      if (h.id === 'codex') {
        expect(text).toContain('[mcp_servers.sparky.env]\nELECTRON_RUN_AS_NODE = "1"\n')
        expect(text).toContain('SPARKY_BIN_DIR = "C:\\\\Programs\\\\Sparky\\\\resources\\\\bin"')
      } else {
        expect(JSON.parse(text.replace(/^\uFEFF/, '')).mcpServers.sparky.env).toEqual(EXE_ENTRY.env)
      }
      expect(installHarness(h.id, { home, vars: env, ...EXE_ENTRY }).changed).toBe(false)
      const moved = { ...EXE_ENTRY, env: { ...EXE_ENTRY.env, SPARKY_BIN_DIR: 'D:\\Elsewhere\\bin' } }
      expect(detectHarnesses(home, env, moved).find((c) => c.id === h.id)!.current).toBe(false)
    })
  }

  it('keeps a user env key while setting ours', () => {
    const file = path.join(home, '.claude.json')
    fs.writeFileSync(file, JSON.stringify({ mcpServers: { sparky: { command: 'old', args: [], env: { SPARKY_LOCAL: '1' } } } }))
    installHarness('claude-code', { home, vars: env, ...EXE_ENTRY })
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers.sparky.env).toEqual({ SPARKY_LOCAL: '1', ...EXE_ENTRY.env })
    const toml = path.join(home, '.codex', 'config.toml')
    fs.mkdirSync(path.dirname(toml), { recursive: true })
    fs.writeFileSync(toml, '[mcp_servers.sparky]\ncommand = "old"\nargs = []\n\n[mcp_servers.sparky.env]\nSPARKY_LOCAL = "1"\nSPARKY_BIN_DIR = "old"\n')
    installHarness('codex', { home, vars: env, ...EXE_ENTRY })
    const text = fs.readFileSync(toml, 'utf8')
    expect(text).toContain('SPARKY_LOCAL = "1"')
    expect(text.match(/SPARKY_BIN_DIR/g)!.length).toBe(1)
    expect(detectHarnesses(home, env, EXE_ENTRY).find((c) => c.id === 'codex')!.current).toBe(true)
  })

  it('refuses a codex env written inline in the sparky table when env must be set', () => {
    const file = path.join(home, '.codex', 'config.toml')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const text = '[mcp_servers.sparky]\ncommand = "x"\nenv = { A = "1" }\n'
    fs.writeFileSync(file, text)
    expect(() => installHarness('codex', { home, vars: env, ...EXE_ENTRY })).toThrow(HarnessError)
    expect(fs.readFileSync(file, 'utf8')).toBe(text)
    expect(installHarness('codex', { home, vars: env, ...mcpEntry('win32') }).changed).toBe(true)
  })
})

describe('codex: sparky defined with dotted keys', () => {
  const forms: Record<string, string> = {
    'dotted under [mcp_servers]': '[mcp_servers]\nsparky.command = "x"\n',
    'quoted dotted under [mcp_servers]': '[mcp_servers]\n"sparky".args = []\n',
    'root-level dotted': 'model = "o4"\nmcp_servers.sparky.command = "x"\n\n[other]\na = 1\n',
    'root-level quoted dotted': 'mcp_servers."sparky".command = "x"\n',
  }
  for (const [name, text] of Object.entries(forms)) {
    it(`${name}: counted as installed and refused, file untouched`, () => {
      const file = path.join(home, '.codex', 'config.toml')
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, text)
      expect(detectHarnesses(home, env).find((c) => c.id === 'codex')!.installed).toBe(true)
      expect(() => installHarness('codex', { home, vars: env, ...mcpEntry('linux') })).toThrow(HarnessError)
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    })
  }

  it('a root-level key after the first header is not the root table', () => {
    const file = path.join(home, '.codex', 'config.toml')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '[profiles.x]\nmcp_servers.sparky.command = "x"\n')
    expect(installHarness('codex', { home, vars: env, ...mcpEntry('linux') }).changed).toBe(true)
  })
})

describe('applyWrite', () => {
  it('removes its temp file when the rename fails', () => {
    const dir = path.join(home, 'target')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'x'), '')
    expect(() => applyWrite({ file: dir, before: '', after: '{}', changed: true })).toThrow()
    expect(fs.readdirSync(home).filter((n) => n.includes('.tmp'))).toEqual([])
  })
})

describe('CLAUDE_CONFIG_DIR', () => {
  it('moves the Claude Code config and counts the folder as a marker', () => {
    const dir = path.join(home, 'claude-cfg')
    const cfg = { CLAUDE_CONFIG_DIR: dir }
    const claude = HARNESSES.find((h) => h.id === 'claude-code')!
    expect(claude.configPath(home, cfg)).toBe(path.join(dir, '.claude.json'))
    expect(detectHarnesses(home, cfg).find((c) => c.id === 'claude-code')!.found).toBe(false)
    fs.mkdirSync(dir)
    expect(detectHarnesses(home, cfg).find((c) => c.id === 'claude-code')).toMatchObject({ found: true, configPath: path.join(dir, '.claude.json') })
    expect(installHarness('claude-code', { home, vars: cfg, ...mcpEntry('linux') }).file).toBe(path.join(dir, '.claude.json'))
  })
})
