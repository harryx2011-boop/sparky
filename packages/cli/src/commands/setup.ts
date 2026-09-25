// `sparky setup`: fetches FFmpeg, yt-dlp and the other tools for an npm install that has no app beside it.
import path from 'node:path'
import { fetchTools, findExtractor, hasAllTools, planTools } from '../../../../scripts/fetch-tools.mjs'
import { parseArgv } from '../args'
import { cliPaths } from '../env'
import { CliError, EXIT, messageOf, UsageError } from '../errors'
import type { Command, Io } from './types'

/** 7zip-bin's 7za, loaded through require() like the other externals so it resolves beside the bundle or on NODE_PATH. */
async function path7za(): Promise<string | undefined> {
  try {
    return (await import('7zip-bin')).path7za
  } catch {
    return undefined
  }
}

/** The first tool folder other than `binDir` that already has everything: the installed app's resources\bin. */
function bundledDir(binDir: string): string | undefined {
  const own = path.resolve(binDir).toLowerCase()
  return cliPaths().binDirs.find((d) => path.resolve(d).toLowerCase() !== own && hasAllTools(d))
}

async function extractorOrThrow(): Promise<string> {
  try {
    return findExtractor({ path7za: await path7za() })
  } catch (e) {
    throw new CliError(messageOf(e), EXIT.unavailable)
  }
}

function printPlan(io: Io, binDir: string, force: boolean, unpack: string): void {
  for (const p of planTools({ binDir, force })) io.out(p.present ? `  ${p.id}: already in ${binDir}` : `  ${p.id}: would fetch from ${p.from} into ${p.to}`)
  io.out(`Unpacks with: ${unpack}`)
}

export const setupCommand: Command = {
  name: 'setup',
  usage: 'setup [--force] [--dry-run]',
  summary: "Download FFmpeg, yt-dlp, Pandoc, 7-Zip and Deno into Sparky's data folder (for npm installs).",
  help: [
    'Usage: sparky setup [--force] [--dry-run]',
    '',
    'Downloads the programs Sparky runs into <data folder>\\bin, which every command searches first. The Windows app',
    'already ships them, so with the app installed this does nothing. --force downloads them again;',
    '--dry-run prints what would be fetched, where, and the unpacker it would use.',
  ].join('\n'),
  async run(argv, { io }) {
    const raw = parseArgv(argv, { booleans: new Set(['force', 'dry-run', 'help']) })
    for (const name of raw.flags.keys()) if (!['force', 'dry-run', 'help'].includes(name)) throw new UsageError(`Unknown option --${name} for "sparky setup".`)
    if (raw.positionals.length) throw new UsageError('"sparky setup" takes no arguments.')
    if (raw.flags.get('help')) return (io.out(this.help), EXIT.ok)
    if (process.platform !== 'win32') throw new CliError('"sparky setup" fetches the Windows builds. Here, install ffmpeg, yt-dlp and pandoc with your package manager; Sparky finds them on PATH.', EXIT.unavailable)
    const force = raw.flags.get('force')?.at(-1) === true
    const dryRun = raw.flags.get('dry-run')?.at(-1) === true
    const binDir = path.join(cliPaths().dataDir, 'bin')

    const bundled = force ? undefined : bundledDir(binDir)
    if (bundled) {
      io.out(`The tools are already bundled with the Sparky app in ${bundled}. Nothing to fetch.`)
      return EXIT.ok
    }

    const unpack = await extractorOrThrow()
    if (dryRun) {
      io.out(`sparky setup would put the tools in ${binDir}:`)
      printPlan(io, binDir, force, unpack)
      return EXIT.ok
    }
    const res = await fetchTools({
      binDir,
      force,
      path7za: await path7za(),
      log: (l: string) => io.out(l),
      warn: (l: string) => io.err(l),
      write: (t: string) => void process.stderr.write(t),
    })
    io.out(`\nTools are in ${binDir}`)
    return res.ok ? EXIT.ok : EXIT.unavailable
  },
}
