// Where a result goes. The caller's `out` wins, then originals "replace" (beside the source), then the output root's category folder.
import { explainFileError, isCompressOnly, normalizeExt, OUTPUT_FOLDERS, outputName, type Category, type Settings } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface OutTarget {
  dir: string
  /** Set when `out` names a file rather than a folder. */
  file?: string
}

/** A folder when it already is one, ends in a separator or has no extension; anything else names the output file. */
export function splitOut(out: string): OutTarget {
  const abs = path.resolve(out)
  let isDir = /[\\/]$/.test(out) || !path.extname(abs)
  try {
    isDir ||= fsSync.statSync(abs).isDirectory()
  } catch {
    /* not there yet */
  }
  return isDir ? { dir: abs } : { dir: path.dirname(abs), file: abs }
}

export interface OutputRequest {
  /** The source file; its name seeds the output name. */
  input?: string
  ext: string
  category: Category | 'download'
  /** Added before the extension, e.g. " (smaller)". */
  suffix?: string
  /** Originals "replace": write beside the source, and take its exact name when the format is unchanged (the caller moves the original aside first). */
  replace?: boolean
}

export interface OutputPlan {
  dir: string
  /** Write here first; a hidden name nothing else will pick. */
  tmpPath: string
  /** Picks the final path and reserves it on disk, so no other job or process can take the same name. */
  claimFinal(): Promise<string>
  /** Moves the finished tmpPath onto the claimed path. */
  place(finalPath: string): Promise<void>
  /** Gives the reserved name back when the result never arrived. */
  release(): Promise<void>
}

/** Windows file names ignore case: "Clip.mp4" and "clip.mp4" are the same file. */
const nameKey = (name: string) => (process.platform === 'win32' ? name.toLowerCase() : name)

/** True when two paths name the same file. */
export function samePath(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && nameKey(path.resolve(a)) === nameKey(path.resolve(b))
}

/** A name in `dir` nothing holds yet. `exclude` adds names found taken since the folder was read. */
export async function freeName(dir: string, inputName: string, ext: string, suffix = '', exclude: ReadonlySet<string> = new Set()): Promise<string> {
  const taken = new Set((await fs.readdir(dir).catch(() => [] as string[])).map(nameKey))
  return outputName(inputName, ext, (n) => taken.has(nameKey(n)) || exclude.has(nameKey(n)), suffix)
}

async function reserve(p: string, folder: boolean): Promise<boolean> {
  try {
    if (folder) await fs.mkdir(p)
    else await (await fs.open(p, 'wx')).close()
    return true
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw e
  }
}

export async function planOutput(settings: () => Settings, req: OutputRequest & { out?: string }): Promise<OutputPlan> {
  const ext = normalizeExt(req.ext)
  const folder = ext === 'folder'
  const target = req.out ? splitOut(req.out) : undefined
  const beside = !target && req.replace && req.input
  const dir = target?.dir ?? (beside ? path.dirname(req.input!) : path.join(settings().outputRoot, OUTPUT_FOLDERS[req.category]))
  await fs.mkdir(dir, { recursive: true }).catch((e) => {
    throw new Error(explainFileError(e, 'save'))
  })
  const tmpPath = path.join(dir, `.sparky-${randomUUID().slice(0, 8)}${folder ? '' : `.${ext}`}`)
  const seed = req.input ? path.basename(req.input) : 'Sparky'
  let reserved: string | undefined

  return {
    dir,
    tmpPath,
    async claimFinal() {
      if (target?.file) return target.file
      if (beside && isCompressOnly(req.input!, ext)) return req.input!
      const lost = new Set<string>()
      for (;;) {
        const name = await freeName(dir, seed, ext, req.suffix, lost)
        const p = path.join(dir, name)
        if (await reserve(p, folder)) return (reserved = p)
        // Someone took it between the read and the claim, or the folder listing hides it; never try that name again.
        lost.add(nameKey(name))
      }
    },
    async place(finalPath) {
      // Windows won't rename a folder onto the empty one that holds the name.
      if (folder && finalPath === reserved) await fs.rmdir(finalPath).catch(() => undefined)
      await fs.rename(tmpPath, finalPath)
      reserved = undefined
    },
    async release() {
      if (reserved) await (folder ? fs.rmdir(reserved) : fs.rm(reserved, { force: true })).catch(() => undefined)
      reserved = undefined
    },
  }
}
