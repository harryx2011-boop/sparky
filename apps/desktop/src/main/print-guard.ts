import path from 'node:path'
import { fileURLToPath } from 'node:url'

function inside(folder: string, file: string): boolean {
  const rel = path.relative(folder, file)
  return rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel))
}

export function allowPrintRequest(url: string, folders: readonly string[]): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol === 'data:') return true
  if (parsed.protocol !== 'file:' || parsed.host) return false
  try {
    const file = fileURLToPath(parsed)
    return folders.some((f) => inside(path.resolve(f), file))
  } catch {
    return false
  }
}
