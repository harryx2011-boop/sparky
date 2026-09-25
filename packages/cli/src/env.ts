// Where the CLI finds the app's data, its tools and its API, with the environment overrides applied.
import { apiPort, defaultPaths, type EnginePaths } from '@sparky/engine'
import path from 'node:path'

declare const __SPARKY_VERSION__: string | undefined

/** Set by the build from package.json; 'dev' when run from source. */
export const VERSION = typeof __SPARKY_VERSION__ === 'string' ? __SPARKY_VERSION__ : 'dev'

type Env = Record<string, string | undefined>

/** The environment variables the CLI reads, for `sparky --help`. */
export const ENV_VARS: readonly [name: string, meaning: string][] = [
  ['SPARKY_LOCAL=1', 'Always run jobs in this process, even when the Sparky app is open (same as --local).'],
  ['SPARKY_API_PORT', 'Port of the running app or `sparky serve` (default 8600).'],
  ['SPARKY_BIN_DIR', 'Folder searched first for ffmpeg, yt-dlp and the other tools. The installer sets it.'],
  ['SPARKY_TEST_BIN', 'Folder with the tools for tests, searched after SPARKY_BIN_DIR.'],
  ['SPARKY_DATA_DIR', "Data folder for history, settings and the API token (default: the app's own)."],
]

const set = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)

/** defaultPaths() with SPARKY_DATA_DIR, SPARKY_BIN_DIR and SPARKY_TEST_BIN applied. */
export function cliPaths(env: Env = process.env): EnginePaths {
  const d = defaultPaths()
  const dataDir = set(env.SPARKY_DATA_DIR) ? path.resolve(set(env.SPARKY_DATA_DIR)!) : d.dataDir
  const first = [set(env.SPARKY_BIN_DIR), set(env.SPARKY_TEST_BIN)].filter((x): x is string => x !== undefined).map((p) => path.resolve(p))
  const own = dataDir === d.dataDir ? [] : [path.join(dataDir, 'bin')]
  const binDirs = [...new Set([...first, ...own, ...d.binDirs])]
  return { ...d, dataDir, binDirs }
}

export function localForced(env: Env = process.env): boolean {
  return set(env.SPARKY_LOCAL) === '1'
}

/** The API port: SPARKY_API_PORT, else 8600. */
export function cliApiPort(): number {
  return apiPort()
}
