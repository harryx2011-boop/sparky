// The command contract: every built-in command is one of these, registered by one line in ./index.ts.
import type { OpDescriptor } from '@sparky/engine'
import { pickBackend, type Backend } from '../backend'

export interface Io {
  /** Results: paths, tables, JSON. */
  out(text: string): void
  /** Progress, notes and errors. */
  err(text: string): void
}

export const stdio: Io = {
  out: (t) => void process.stdout.write(t.endsWith('\n') ? t : `${t}\n`),
  err: (t) => void process.stderr.write(t.endsWith('\n') ? t : `${t}\n`),
}

export interface CommandContext {
  io: Io
  /** The op registry, for routing and help without starting an engine. */
  ops: readonly OpDescriptor[]
}

export interface Command {
  name: string
  /** Shown in `sparky --help`, e.g. "cancel <id>". */
  usage: string
  summary: string
  help: string
  run(argv: string[], ctx: CommandContext): Promise<number>
}

export function printJson(io: Io, value: unknown): void {
  io.out(JSON.stringify(value, null, 2))
}

/** Runs `fn` against the app or a local engine, and always closes the local one. */
export async function withBackend<T>(local: boolean, io: Io, fn: (b: Backend) => Promise<T>): Promise<T> {
  const b = await pickBackend({ local, warn: (m) => io.err(m) })
  try {
    return await fn(b)
  } finally {
    await b.close()
  }
}
