// How an agent client should start the installed Sparky's MCP server on this PC.
import path from 'node:path'
import { mcpEntry, type McpEntry } from './harnesses'

export interface EntryContext {
  platform: NodeJS.Platform
  /** The PATH folders, as the app sees them. */
  pathDirs: string[]
  /** The installed app's `resources` folder. */
  resourcesDir: string
  exists(file: string): boolean
}

/**
 * `cmd /c sparky mcp` when the shim is on PATH. Otherwise Sparky.exe run as Node with exactly the settings
 * `resources\cli\sparky.cmd` sets: no cmd in between, so no path character can split the command, and it works
 * in a terminal opened before the installer added the folder to PATH. Null when this is not an installed Sparky
 * (the dev tree has the shim but no Sparky.exe beside `resources`).
 */
export function installedEntry(ctx: EntryContext): McpEntry | null {
  if (ctx.platform !== 'win32') return mcpEntry(ctx.platform)
  const p = path.win32
  if (ctx.pathDirs.some((d) => d.trim() && ctx.exists(p.join(d.trim().replace(/^"|"$/g, ''), 'sparky.cmd')))) return mcpEntry('win32')
  const res = ctx.resourcesDir
  const exe = p.join(res, '..', 'Sparky.exe')
  const lib = p.join(res, 'cli', 'lib')
  if (!ctx.exists(exe) || !ctx.exists(p.join(lib, 'sparky.js'))) return null
  return {
    command: exe,
    args: ['--require', p.join(lib, 'esm-resolve.cjs'), p.join(lib, 'sparky.js'), 'mcp'],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      NODE_PATH: `${p.join(res, 'app.asar.unpacked', 'node_modules')};${p.join(res, 'app.asar', 'node_modules')}`,
      SPARKY_BIN_DIR: p.join(res, 'bin'),
    },
  }
}
