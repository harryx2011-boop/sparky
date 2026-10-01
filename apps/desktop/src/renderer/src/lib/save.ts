import type { Job } from '@sparky/core'
import { toast } from 'sonner'
import { api } from './api'

/** Every file a finished job made. */
export const savable = (jobs: Job[]): string[] => jobs.filter((j) => j.status === 'done').flatMap((j) => j.outputs)

/** Asks where to save, copies the files there and says how it went. */
export async function saveFiles(paths: string[]): Promise<void> {
  if (!paths.length) return
  try {
    const res = await api.files.save(paths)
    if (res.canceled) return
    if (res.saved === 0) toast.error(paths.length === 1 ? 'That file is no longer there.' : 'Those files are no longer there.')
    else if (res.missing > 0) toast.warning(`${res.saved} saved, ${res.missing} could not be found.`)
    else toast.success(res.saved === 1 ? 'Saved' : `${res.saved} files saved`)
  } catch (e) {
    toast.error((e as Error).message)
  }
}
