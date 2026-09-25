// `sparky <op words> …`: any op in the registry, its flags generated from the op's input schema.
import type { Job } from '@sparky/core'
import type { OpDescriptor } from '@sparky/engine'
import { bindArgs, missingRequired, type Bound } from '../args'
import { pickBackend, type Backend } from '../backend'
import { EXIT, UsageError } from '../errors'
import { commandName, fieldsOf, opSchema } from '../fields'
import { opHelp } from '../help'
import { failed, headline, NO_BAR, progressBar, summarize } from '../report'
import { processSecretIo, resolveSecrets, type SecretIo } from '../secrets'
import { printJson, withBackend, type CommandContext } from './types'

export const RESERVED_FLAGS = ['json', 'wait', 'local', 'help'] as const

/** Extra spellings; each applies only when the op has the target field. */
export const FLAG_ALIASES: Record<string, string> = { to: 'output' }

export function bindOp(op: OpDescriptor, argv: readonly string[]): Bound {
  return bindArgs(argv, { schema: opSchema(op), positional: op.positional, aliases: FLAG_ALIASES, reserved: RESERVED_FLAGS, command: commandName(op.id) })
}

/** "Choose one with --output: pdf, jpg, webp" when a target field is missing and the backend can list targets. */
async function missingTargetHint(b: Backend, op: OpDescriptor, args: Record<string, unknown>): Promise<string> {
  const key = op.positional[0]
  const items = key && Array.isArray(args[key]) ? (args[key] as string[]) : []
  if (!items.length) return ''
  try {
    const per = await b.targetsFor(items)
    const exts = [...new Set(per.flatMap((p) => p.targets.filter((t) => t.op === op.id && t.available).map((t) => t.ext)))]
    return exts.length ? ` It can become: ${exts.join(', ')}.` : ''
  } catch {
    return ''
  }
}

function printResult(ctx: CommandContext, op: OpDescriptor, jobs: readonly Job[], json: boolean): void {
  const { io } = ctx
  if (json) return printJson(io, { jobs: jobs.map(summarize) })
  for (const j of jobs) {
    for (const o of j.outputs) io.out(o)
    if (j.status === 'failed') io.err(`Failed: ${j.source ? `${j.source}: ` : ''}${j.error ?? 'no reason given'}`)
    else if (j.status !== 'done') io.err(`${j.status[0]!.toUpperCase()}${j.status.slice(1)}: ${j.source}`)
    if (j.note) io.err(j.note)
  }
  if (jobs.length > 1 || failed(jobs)) io.err(headline(op.label, jobs))
}

export async function runOpCommand(op: OpDescriptor, argv: readonly string[], ctx: CommandContext, secretIo: SecretIo = processSecretIo): Promise<number> {
  const bound = bindOp(op, argv)
  const { reserved } = bound
  if (reserved.help) {
    ctx.io.out(opHelp(op))
    return EXIT.ok
  }
  const json = reserved.json === true
  const wait = reserved.wait !== false
  const titles = Object.fromEntries(fieldsOf(op).map((f) => [f.name, f.title]))
  const args = op.secret.length ? await resolveSecrets(op, bound.args, secretIo, titles) : bound.args
  const missing = missingRequired(args, { schema: opSchema(op), positional: op.positional })

  const local = reserved.local === true
  if (missing.length) {
    const hint = missing.includes('--output') ? await withBackend(local, ctx.io, (b) => missingTargetHint(b, op, args)) : ''
    throw new UsageError(`"${commandName(op.id)}" needs ${missing.join(' and ')}.${hint} Run "${commandName(op.id)} --help".`)
  }

  const backend = await pickBackend({ local, warn: (m) => ctx.io.err(m) })
  try {
    if (!wait) {
      if (backend.kind === 'local') throw new UsageError('--no-wait needs the Sparky app open: without it the job runs in this process and would stop when the command ends.')
      const jobs = await backend.startOp(op.id, args)
      if (json) printJson(ctx.io, { jobs: jobs.map(summarize) })
      else for (const j of jobs) ctx.io.out(j.id)
      return EXIT.ok
    }

    const ac = new AbortController()
    let interrupts = 0
    const onSigint = () => {
      interrupts++
      if (interrupts > 1) process.exit(EXIT.interrupted)
      ac.abort()
    }
    process.on('SIGINT', onSigint)
    const bar = json ? NO_BAR : progressBar(op.label)
    try {
      const jobs = await backend.runOp(op.id, args, { signal: ac.signal, onUpdate: (j) => bar.update(j) })
      bar.done()
      if (ac.signal.aborted) {
        if (json) printJson(ctx.io, { jobs: jobs.map(summarize) })
        else ctx.io.err('Stopped. The jobs this command started were canceled.')
        return EXIT.interrupted
      }
      printResult(ctx, op, jobs, json)
      return failed(jobs) ? EXIT.failed : EXIT.ok
    } finally {
      bar.done()
      process.off('SIGINT', onSigint)
    }
  } finally {
    await backend.close()
  }
}
