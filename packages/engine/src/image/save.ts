// Writes one result the way convert does: to a hidden temporary name, then onto a name claimed only once the file is ready.
import { explainFileError } from '@sparky/core'
import fs from 'node:fs/promises'
import type { OutputRequest } from '../output'
import { throwIfAborted } from '../process'
import type { OpContext } from '../ops/types'

export async function saveResult(ctx: OpContext, req: OutputRequest, write: (tmpPath: string) => Promise<void>): Promise<string> {
  const plan = await ctx.output(req)
  try {
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
    await fs.rm(plan.tmpPath, { recursive: true, force: true }).catch(() => undefined)
    throw e
  }
}
