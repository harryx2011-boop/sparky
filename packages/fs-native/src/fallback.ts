// Node fs version of list(): same columns, used when the addon fails to load; slow on big folders.
import { lstatSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Listing } from './types'

const DIRECTORY = 0x10
const REPARSE_POINT = 0x400

function linksToFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function listFallback(path: string): Listing {
  const entries = readdirSync(path, { withFileTypes: true })
  const n = entries.length
  const listing: Listing = {
    names: new Array<string>(n),
    kinds: new Uint8Array(n),
    sizes: new Float64Array(n),
    mtimes: new Float64Array(n),
    ctimes: new Float64Array(n),
    attrs: new Uint32Array(n),
  }
  entries.forEach((entry, i) => {
    const full = join(path, entry.name)
    const stat = lstatSync(full)
    const link = entry.isSymbolicLink()
    const dir = entry.isDirectory() || (link && linksToFolder(full))
    listing.names[i] = entry.name
    listing.kinds[i] = dir ? 1 : 0
    listing.sizes[i] = dir ? 0 : stat.size
    listing.mtimes[i] = Math.floor(stat.mtimeMs)
    listing.ctimes[i] = Math.floor(stat.birthtimeMs)
    listing.attrs[i] = (dir ? DIRECTORY : 0) | (link ? REPARSE_POINT : 0)
  })
  return listing
}
