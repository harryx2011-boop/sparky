// `sparky init`: adds Sparky's MCP server to the agent clients on this PC.
import { tokenPath } from '@sparky/engine'
import os from 'node:os'
import { parseArgv } from '../args'
import { cliApiPort, cliPaths } from '../env'
import { EXIT, UsageError } from '../errors'
import { detectHarnesses, diff, harnessById, HARNESSES, installHarness, mcpEntry, type Harness } from '../harnesses'
import type { Command, Io } from './types'

const CLIENTS = HARNESSES.map((h) => h.id).join('|')

export interface InitOptions {
  clients: string[]
  dryRun: boolean
  home?: string
  env?: Record<string, string | undefined>
  platform?: NodeJS.Platform
}

export function runInit(opts: InitOptions, io: Io): number {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  let targets: Harness[]
  if (opts.clients.includes('all')) targets = [...HARNESSES]
  else if (opts.clients.length) {
    targets = opts.clients.map((id) => {
      const h = harnessById(id)
      if (!h) throw new UsageError(`Unknown client "${id}". Choose from: ${CLIENTS}, all.`)
      return h
    })
  } else {
    targets = detectHarnesses(home, env)
      .filter((s) => s.found)
      .map((s) => harnessById(s.id)!)
    if (!targets.length) throw new UsageError(`Found no agent client in ${home}. Name one: sparky init --client ${CLIENTS}`)
  }

  const entry = mcpEntry(opts.platform)
  for (const h of targets) {
    const r = installHarness(h.id, { home, vars: env, ...entry, dryRun: opts.dryRun })
    if (!r.changed) io.out(`${h.label}: already set up in ${r.file}`)
    else if (opts.dryRun) io.out(`${h.label}: would update ${r.file}\n${diff(r)}`)
    else io.out(`${h.label}: added "sparky" to ${r.file}. Restart ${h.label} to load it.`)
    if (h.equivalent) io.out(`  Same thing by hand: ${h.equivalent(entry)}`)
  }
  const paths = cliPaths(env)
  io.out(`\nHTTP API: http://127.0.0.1:${cliApiPort()} while the Sparky app (or "sparky serve") runs.`)
  io.out(`Its bearer token is in ${tokenPath(paths.dataDir)} (created on first start).`)
  return EXIT.ok
}

export const initCommand: Command = {
  name: 'init',
  usage: `init [--client <id>] [--dry-run]`,
  summary: 'Add Sparky as an MCP server to Claude Code, Cursor, Codex or Windsurf.',
  help: [
    `Usage: sparky init [--client ${CLIENTS}|all] [--dry-run]`,
    '',
    'Adds the "sparky" MCP server (it runs "sparky mcp") to each client\'s user settings, leaving every other entry as it is.',
    'With no --client, sets up every client found in your home folder. Repeat --client for more than one.',
    '--dry-run prints the change without writing it.',
  ].join('\n'),
  async run(argv, { io }) {
    const raw = parseArgv(argv, { booleans: new Set(['dry-run', 'help']) })
    for (const name of raw.flags.keys()) if (!['client', 'dry-run', 'help'].includes(name)) throw new UsageError(`Unknown option --${name} for "sparky init".`)
    if (raw.positionals.length) throw new UsageError(`"sparky init" takes no arguments. Use --client ${CLIENTS}.`)
    if (raw.flags.get('help')) return (io.out(this.help), EXIT.ok)
    const clients = (raw.flags.get('client') ?? []).flatMap((v) => {
      if (typeof v !== 'string') throw new UsageError(`--client needs a value: ${CLIENTS} or all.`)
      return v.split(',').map((s) => s.trim()).filter(Boolean)
    })
    return runInit({ clients, dryRun: raw.flags.get('dry-run')?.at(-1) === true }, io)
  },
}
