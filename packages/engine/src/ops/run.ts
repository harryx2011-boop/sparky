// Between the queue and the registry: validating input, splitting it into jobs, and running a job's op.
import { categoryOf, invalidOpArgsError, unknownOpError, type Job, type Settings } from '@sparky/core'
import path from 'node:path'
import type { EngineEnv } from '../convert'
import { planOutput } from '../output'
import type { RunContext } from '../queue'
import { progressPatch } from './fields'
import { fullInput, opById } from './index'
import { OpInputError, type Op, type OpContext, type OpJobFields } from './types'

/** Absolute, keeping a trailing separator, which marks a folder that doesn't exist yet. */
function absoluteOut(out: string): string {
  const abs = path.resolve(out)
  return /[\\/]$/.test(out) && !/[\\/]$/.test(abs) ? abs + path.sep : abs
}

export interface ParsedInput {
  args: Record<string, unknown>
  out?: string
}

export function parseOpInput(op: Op, raw: unknown): ParsedInput {
  const res = fullInput(op).safeParse(raw ?? {})
  if (!res.success) {
    const where = (p: PropertyKey[]) => p.map(String).join('.')
    const problems = res.error.issues.map((i) => (i.path.length ? `${where(i.path)}: ${i.message}` : i.message))
    const first = res.error.issues[0]
    throw new OpInputError('invalid_input', invalidOpArgsError(op.label, problems), first?.path.length ? where(first.path) : undefined)
  }
  const { out, ...args } = res.data as Record<string, unknown> & { out?: string }
  for (const key of op.paths ?? []) {
    const v = args[key]
    if (typeof v === 'string') args[key] = path.resolve(v)
    else if (Array.isArray(v)) args[key] = v.map((p: unknown) => (typeof p === 'string' ? path.resolve(p) : p))
  }
  return { args, out: out === undefined ? undefined : absoluteOut(out) }
}

/** 'each' ops become one input per item of their first positional field; 'all' ops stay whole. */
export function splitInput(op: Op, args: Record<string, unknown>): Record<string, unknown>[] {
  const key = op.positional[0]
  const list = key === undefined ? undefined : args[key]
  if (op.arity !== 'each' || key === undefined || !Array.isArray(list) || list.length < 2) return [args]
  return list.map((item) => ({ ...args, [key]: [item] }))
}

export function jobFields(op: Op, args: Record<string, unknown>, settings: Settings): OpJobFields {
  const key = op.positional[0]
  const first = key === undefined ? undefined : args[key]
  const item: unknown = Array.isArray(first) ? first[0] : first
  const source = typeof item === 'string' ? item : ''
  return { title: op.label, source, category: categoryOf(source), ...op.describe?.(args, settings) }
}

export function opContext(env: EngineEnv, run: Pick<RunContext, 'signal' | 'update'>, out?: string): OpContext {
  return {
    ...env,
    signal: run.signal,
    progress: (p) => run.update(progressPatch(p)),
    out,
    output: (req) => planOutput(env.settings, { ...req, out }),
  }
}

/** Set in stored args when the job was given a secret field. */
export const SECRET_GIVEN = 'secretGiven'

/** Splits validated args into what may be stored and the op's secret fields, which only live in memory. */
export function splitSecrets(op: Op, args: Record<string, unknown>): { kept: Record<string, unknown>; hidden?: Record<string, unknown> } {
  const keys = (op.secret ?? []).filter((k) => args[k] !== undefined)
  if (!keys.length) return { kept: args }
  // The marker says a secret was given, so a rerun from History knows to ask for it; op schemas drop unknown keys.
  const kept: Record<string, unknown> = { ...args, [SECRET_GIVEN]: true }
  const hidden: Record<string, unknown> = {}
  for (const k of keys) {
    hidden[k] = kept[k]
    delete kept[k]
  }
  return { kept, hidden }
}

/** The queue's runner: look the op up by id and run it. `secrets` are the fields kept out of `job.args`. */
export async function runOpJob(env: EngineEnv, job: Job, run: RunContext, secrets?: Record<string, unknown>): Promise<Partial<Job>> {
  const op = opById(job.op)
  if (!op) throw new Error(unknownOpError(job.op))
  const { args, out } = parseOpInput(op, secrets ? { ...(job.args as Record<string, unknown>), ...secrets } : job.args)
  const r = await op.run(opContext(env, run, out), args)
  return { outputs: r.outputs, sizeBefore: r.sizeBefore, sizeAfter: r.sizeAfter, note: r.warnings?.length ? r.warnings.join(' ') : undefined }
}
