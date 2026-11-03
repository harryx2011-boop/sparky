// The command contract: every built-in command is one of these, registered by one line in ./index.ts.
import type { OpDescriptor } from '@sparky/engine'
import { pickBackend, type Backend } from '../backend'

export interface Io {
  out(text: string): void
  err(text: string): void
}

export const stdio: Io = {
  out: (t) => void process.stdout.write(t.endsWith('\n') ? t : `${t}\n`),
  err: (t) => void process.stderr.write(t.endsWith('\n') ? t : `${t}\n`),
}

export interface CommandContext {
  io: Io
  ops: readonly OpDescriptor[]
}

export interface Command {
  name: string
  usage: string
  summary: string
  help: string
  run(argv: string[], ctx: CommandContext): Promise<number>
}

export function printJson(io: Io, value: unknown): void {
  io.out(JSON.stringify(value, null, 2))
}

export async function withBackend<T>(local: boolean, io: Io, fn: (b: Backend) => Promise<T>): Promise<T> {
  const b = await pickBackend({ local, warn: (m) => io.err(m) })
  try {
    return await fn(b)
  } finally {
    await b.close()
  }
}
