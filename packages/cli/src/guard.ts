// Where `sparky mcp` lets an agent read and write. Applies to the MCP only; the CLI is the user's own hands.
import type { OpDescriptor } from '@sparky/engine'
import fs from 'node:fs'
import path from 'node:path'
import { cliPaths } from './env'

type Env = Record<string, string | undefined>

export class GuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuardError'
  }
}

/** SPARKY_MCP_ROOTS (`;`-separated), else the Sparky output folder and the folder the client started the server in. */
export function mcpRoots(env: Env, outputRoot: string, cwd: string): string[] {
  const set = env.SPARKY_MCP_ROOTS?.trim()
  const list = set ? set.split(';').map((s) => s.trim()).filter(Boolean) : [outputRoot, cwd]
  return list.map((p) => path.resolve(p))
}

export function guardOptions(env: Env = process.env, cwd: string = process.cwd()): { roots: string[]; allowReplace: boolean } {
  return { roots: mcpRoots(env, cliPaths(env).defaultRoot, cwd), allowReplace: env.SPARKY_MCP_ALLOW_REPLACE === '1' }
}

/** The path with `..`, junctions and symlinks resolved on its deepest existing part, so a link inside a root can't lead out. */
function real(p: string): string {
  const abs = path.resolve(p)
  const tail: string[] = []
  let head = abs
  while (!fs.existsSync(head)) {
    const up = path.dirname(head)
    if (up === head) return abs
    tail.unshift(path.basename(head))
    head = up
  }
  return path.join(fs.realpathSync(head), ...tail)
}

const UNC = /^[\\/]{2}/

function inside(root: string, target: string): boolean {
  const rel = path.relative(real(root), target)
  return rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel))
}

const same = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)

/** Throws a GuardError naming the way out when an input, `out` or `originals` breaks the rules. Download links are not paths. */
export function checkPaths(op: Pick<OpDescriptor, 'positional' | 'accepts'>, args: Record<string, unknown>, roots: readonly string[], allowReplace = false): void {
  const inputs = op.accepts.length
    ? op.positional.flatMap((k) => (Array.isArray(args[k]) ? (args[k] as unknown[]) : [args[k]])).filter((v): v is string => typeof v === 'string')
    : []
  const out = typeof args.out === 'string' ? args.out : undefined
  for (const p of [...inputs, ...(out ? [out] : [])]) {
    if (UNC.test(p) || !roots.some((r) => inside(r, real(p)))) {
      throw new GuardError(`"${p}" is outside the folders the Sparky MCP may use (${roots.join('; ')}). Use a file or folder under one of them, or set SPARKY_MCP_ROOTS for the MCP server.`)
    }
  }
  if (allowReplace) return
  const replacing = args.originals === 'replace' || args.originals === 'trash' || (out !== undefined && inputs.some((i) => same(real(i), real(out))))
  if (replacing) throw new GuardError('Replacing or trashing the original files, or saving over an input, is off for the Sparky MCP. Leave `originals` as keep and give a different `out`, or set SPARKY_MCP_ALLOW_REPLACE=1 for the MCP server.')
}
