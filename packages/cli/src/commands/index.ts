// The command registry and the router. Adding a built-in = one module + one line in COMMANDS; op commands come from the op registry.
import type { OpDescriptor } from '@sparky/engine'
import { suggest } from '../args'
import { VERSION } from '../env'
import { UsageError } from '../errors'
import { commandWords } from '../fields'
import { groupHelp, groups, mainHelp } from '../help'
import { initCommand } from './init'
import { mcpCommand } from './mcp'
import { runOpCommand } from './op'
import { cancelCommand, formatsCommand, jobsCommand, opsCommand } from './query'
import { serveCommand } from './serve'
import { setupCommand } from './setup'
import type { Command, CommandContext } from './types'

export const COMMANDS: readonly Command[] = [opsCommand, formatsCommand, jobsCommand, cancelCommand, serveCommand, mcpCommand, initCommand, setupCommand]

export type Route =
  | { kind: 'text'; text: string }
  | { kind: 'command'; command: Command; argv: string[] }
  | { kind: 'op'; op: OpDescriptor; argv: string[] }

const isHelp = (t: string | undefined) => t === '--help' || t === '-h'

/** "from-images" and "from_images" name the same tool. */
const norm = (w: string) => w.toLowerCase().replace(/-/g, '_')

function findOp(ops: readonly OpDescriptor[], words: string[]): OpDescriptor | undefined {
  const id = words.map(norm).join('.')
  return ops.find((o) => norm(o.id) === id)
}

/** argv (without node and the script) → what to run. Throws UsageError for a name that matches nothing. */
export function route(argv: readonly string[], ops: readonly OpDescriptor[], commands: readonly Command[] = COMMANDS): Route {
  const [first, ...rest] = argv
  if (first === undefined || isHelp(first)) return { kind: 'text', text: mainHelp(ops, commands) }
  if (first === '--version' || first === '-v' || first === 'version') return { kind: 'text', text: VERSION }
  if (first === 'help') return rest.length ? route([...rest, '--help'], ops, commands) : { kind: 'text', text: mainHelp(ops, commands) }

  const command = commands.find((c) => c.name === first)
  if (command) return { kind: 'command', command, argv: rest }

  // `sparky pdf.merge …` and `sparky convert …`
  const direct = findOp(ops, first.split('.'))
  if (direct) return { kind: 'op', op: direct, argv: rest }

  const g = groups(ops)
  const members = g.get(norm(first)) ?? g.get(first)
  if (members) {
    const [tool, ...tail] = rest
    if (tool === undefined || isHelp(tool)) return { kind: 'text', text: groupHelp(first, members) }
    const op = findOp(ops, [first, tool])
    if (op) return { kind: 'op', op, argv: tail }
    const names = members.map((o) => commandWords(o.id).slice(1).join(' '))
    const near = suggest(tool.replace(/_/g, '-'), names)
    throw new UsageError(`"sparky ${first}" has no tool "${tool}".${near ? ` Did you mean "sparky ${first} ${near}"?` : ''} Tools: ${names.join(', ')}.`)
  }

  const names = [...commands.map((c) => c.name), ...[...g.keys()].filter(Boolean), ...(g.get('') ?? []).map((o) => o.id)]
  const near = suggest(first, names)
  throw new UsageError(`Unknown command "${first}".${near ? ` Did you mean "sparky ${near}"?` : ''} Run "sparky --help".`)
}

export async function dispatch(argv: readonly string[], ctx: CommandContext, commands: readonly Command[] = COMMANDS): Promise<number> {
  const r = route(argv, ctx.ops, commands)
  if (r.kind === 'text') {
    ctx.io.out(r.text)
    return 0
  }
  if (r.kind === 'command') return r.command.run(r.argv, ctx)
  return runOpCommand(r.op, r.argv, ctx)
}
