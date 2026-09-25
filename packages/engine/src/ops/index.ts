// The op registry. Adding an op = one file in this folder + one line in OPS (+ its words in core's OP_TEXT).
import { INPUT_EXTS, type JobKind } from '@sparky/core'
import { z } from 'zod/v4'
import type { ToolId } from '../tools'
import { convertOp } from './convert'
import { downloadOp } from './download'
import { imageOps } from './image'
import { mediaOps } from './media'
import { ocrOps } from './ocr'
import { pdfOps } from './pdf'
import type { Op, OpCategory } from './types'

export const OPS = [convertOp, downloadOp] as const

const ALL: readonly Op[] = [...OPS, ...pdfOps, ...mediaOps, ...imageOps, ...ocrOps]

export function opById(id: string): Op | undefined {
  return ALL.find((op) => op.id === id)
}

/** Every op, as the registry declares it. */
export function allOps(): readonly Op[] {
  return ALL
}

/** Input names the surfaces keep for themselves; no op may declare one. */
export const RESERVED_INPUTS = ['out', 'wait', 'json', 'help'] as const

const full = new WeakMap<Op, z.ZodObject>()

/** The op's input plus `out`, which the engine adds to every op: a file or a folder that wins over the output root. */
export function fullInput(op: Op): z.ZodObject {
  let s = full.get(op)
  if (!s) full.set(op, (s = op.input.extend({ out: z.string().min(1).optional() })))
  return s
}

const MAX = Number.MAX_SAFE_INTEGER

/** `.int()` writes ±MAX_SAFE_INTEGER bounds that mean nothing to a caller. */
function dropSafeIntBounds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropSafeIntBounds)
  if (!v || typeof v !== 'object') return v
  return Object.fromEntries(
    Object.entries(v)
      .filter(([k, x]) => !((k === 'minimum' || k === 'maximum') && (x === MAX || x === -MAX)))
      .map(([k, x]) => [k, dropSafeIntBounds(x)]),
  )
}

const schemas = new WeakMap<Op, Record<string, unknown>>()

/** JSON Schema of what a caller sends (`io: 'input'`), for the MCP tool list, the HTTP API and the CLI. */
export function inputSchema(op: Op): Record<string, unknown> {
  let js = schemas.get(op)
  if (!js) {
    const raw = z.toJSONSchema(fullInput(op), { io: 'input', unrepresentable: 'throw' }) as Record<string, unknown>
    delete raw.$schema
    schemas.set(op, (js = dropSafeIntBounds(raw) as Record<string, unknown>))
  }
  return js
}

/** Every extension core knows how to read. */
function knownInputs(): readonly string[] {
  return INPUT_EXTS
}

export interface OpDescriptor {
  id: string
  label: string
  doneLabel: string
  category: OpCategory
  kind: JobKind
  arity: Op['arity']
  positional: string[]
  requires: ToolId[]
  /** Fields to render as password inputs and never store. */
  secret: string[]
  /** The extensions this op takes, from core's known inputs. */
  accepts: string[]
  inputSchema: Record<string, unknown>
}

export function describeOp(op: Op): OpDescriptor {
  return {
    id: op.id,
    label: op.label,
    doneLabel: op.doneLabel,
    category: op.category,
    kind: op.kind,
    arity: op.arity,
    positional: op.positional,
    requires: op.requires ?? [],
    secret: op.secret ?? [],
    accepts: knownInputs().filter((e) => op.accepts(e)),
    inputSchema: inputSchema(op),
  }
}

export function listOps(): OpDescriptor[] {
  return ALL.map(describeOp)
}

export { convertArgs } from './convert'
export { downloadArgs } from './download'
export * from './types'
