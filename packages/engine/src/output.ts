// Where a result goes. The caller's `out` wins, then originals "replace" (beside the source), then the output root's category folder.
import { explainFileError, isCompressOnly, normalizeExt, OUTPUT_FOLDERS, outputName, type Category, type Settings } from '@sparky/core'
import { randomUUID } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface OutTarget {
  dir: string
  file?: string
}

export function splitOut(out: string): OutTarget {
  const abs = path.resolve(out)
  let isDir = /[\\/]$/.test(out) || !path.extname(abs)
  try {
    isDir ||= fsSync.statSync(abs).isDirectory()
  } catch {
  }
  return isDir ? { dir: abs } : { dir: path.dirname(abs), file: abs }
}

export interface OutputRequest {
  input?: string
  ext: string
  category: Category | 'download'
  suffix?: string
  replace?: boolean
}

export interface OutputPlan {
  dir: string
  tmpPath: string
  claimFinal(): Promise<string>
  place(finalPath: string): Promise<void>
  release(): Promise<void>
}

const nameKey = (name: string) => (process.platform === 'win32' ? name.toLowerCase() : name)

export function samePath(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && nameKey(path.resolve(a)) === nameKey(path.resolve(b))
}

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
        lost.add(nameKey(name))
      }
    },
    async place(finalPath) {
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
