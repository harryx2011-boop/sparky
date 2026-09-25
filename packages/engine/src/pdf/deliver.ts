// Every pdf op's output path: write to the plan's hidden temporary name, then claim the final name and move it there.
import { explainFileError } from '@sparky/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { OutputRequest } from '../output'
import { throwIfAborted } from '../process'
import type { OpContext } from '../ops/types'

/** Runs `write` against a temporary path and returns where the finished file or folder ended up. */
export async function deliver(ctx: OpContext, req: OutputRequest, write: (tmpPath: string) => Promise<void>): Promise<string> {
  const plan = await ctx.output(req)
  const cleanup = () => fs.rm(plan.tmpPath, { recursive: true, force: true }).catch(() => undefined)
  try {
    if (req.ext === 'folder') await fs.mkdir(plan.tmpPath, { recursive: true })
    await write(plan.tmpPath)
    throwIfAborted(ctx.signal)
    const finalPath = await plan.claimFinal()
    try {
      await plan.place(finalPath)
    } catch (e) {
      await plan.release()
      throw (e as NodeJS.ErrnoException).code ? new Error(explainFileError(e, 'save')) : e
    }
    return finalPath
  } catch (e) {
    await cleanup()
    throw e
  }
}

/** The source's name without its extension, for the files a folder output holds. */
export function baseName(file: string): string {
  return path.parse(file).name
}

export async function writeFile(file: string, data: Uint8Array | Buffer): Promise<void> {
  try {
    await fs.writeFile(file, data)
  } catch (e) {
    throw new Error(explainFileError(e, 'save'))
  }
}

/** Lets timers and I/O run between pages, so a cancel sent from outside gets through a long, mostly synchronous job. */
export const breathe = () => new Promise<void>((resolve) => setImmediate(resolve))
