// The `sparky` entry point: route argv to a command or an op, print what went wrong, exit with its code.
import { listOps } from '@sparky/engine'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dispatch } from './commands'
import { stdio, type Io } from './commands/types'
import { exitCodeFor, messageOf } from './errors'

export async function main(argv: readonly string[], io: Io = stdio): Promise<number> {
  try {
    return await dispatch(argv, { io, ops: listOps() })
  } catch (e) {
    io.err(messageOf(e))
    if (process.env.SPARKY_DEBUG === '1' && e instanceof Error && e.stack) io.err(e.stack)
    return exitCodeFor(e)
  }
}

function isEntry(): boolean {
  const script = process.argv[1]
  if (!script) return false
  try {
    const a = pathToFileURL(fs.realpathSync(script)).href
    const b = import.meta.url
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
  } catch {
    return false
  }
}

if (isEntry()) {
  const code = await main(process.argv.slice(2))
  process.stdout.write('', () => process.exit(code))
}
