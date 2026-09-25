// Input fields and helpers more than one op shares.
import type { Job } from '@sparky/core'
import { z } from 'zod/v4'
import type { RunContext } from '../queue'
import type { OpContext, OpProgress } from './types'

export const compressionField = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
export const performanceField = z.enum(['low', 'normal', 'max'])
export const heights = [z.literal(720), z.literal(1080), z.literal(1440), z.literal(2160)] as const

/** Drops keys whose value is undefined, so stored input stays small and spreads never clear a default. */
export function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** An op's progress as a job patch. A key given as undefined clears that field. */
export function progressPatch(p: OpProgress): Partial<Job> {
  const patch: Partial<Job> = {}
  if (p.fraction !== undefined) patch.progress = p.fraction === null ? -1 : p.fraction
  if ('speed' in p) patch.speed = p.speed
  if ('eta' in p) patch.eta = p.eta
  if ('stage' in p) patch.stage = p.stage
  if ('note' in p) patch.note = p.note
  return patch
}

/** convertFile and downloadLink still report as job patches; this routes them through ctx.progress. */
export function legacyRun(ctx: OpContext): Pick<RunContext, 'signal' | 'update'> {
  return {
    signal: ctx.signal,
    update: (u) => {
      const p: OpProgress = {}
      if (u.progress !== undefined) p.fraction = u.progress < 0 ? null : u.progress
      if ('speed' in u) p.speed = u.speed
      if ('eta' in u) p.eta = u.eta
      if ('stage' in u) p.stage = u.stage
      if ('note' in u) p.note = u.note
      ctx.progress(p)
    },
  }
}
