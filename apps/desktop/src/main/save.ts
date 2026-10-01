import fsp from 'node:fs/promises'
import path from 'node:path'

/** `name.ext` becomes `name (2).ext`, `name (3).ext`… until it is not in `taken` (compared without case, as Windows does). */
export function uniqueName(name: string, taken: Set<string>): string {
  const ext = path.extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = name
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`
  return candidate
}

/** Copies each file into `dir`, never overwriting what is already there. Files that cannot be copied are returned, not thrown. */
export async function copyInto(dir: string, files: string[]): Promise<{ saved: string[]; failed: string[] }> {
  await fsp.mkdir(dir, { recursive: true })
  const taken = new Set((await fsp.readdir(dir)).map((n) => n.toLowerCase()))
  const saved: string[] = []
  const failed: string[] = []
  for (const file of files) {
    const name = uniqueName(path.basename(file), taken)
    try {
      await fsp.copyFile(file, path.join(dir, name), 1 /* COPYFILE_EXCL */)
      taken.add(name.toLowerCase())
      saved.push(path.join(dir, name))
    } catch {
      failed.push(file)
    }
  }
  return { saved, failed }
}

/** Copies one file to the exact path the user picked; the save dialog has already confirmed any overwrite. */
export async function copyTo(dest: string, file: string): Promise<boolean> {
  if (path.resolve(dest).toLowerCase() === path.resolve(file).toLowerCase()) return true
  try {
    await fsp.copyFile(file, dest)
    return true
  } catch {
    return false
  }
}
