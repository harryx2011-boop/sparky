// Node fs version of list(): same columns, used when the addon fails to load; slow on big folders.
import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Listing } from './types'

const DIRECTORY = 0x10

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
    const stat = lstatSync(join(path, entry.name))
    const dir = entry.isDirectory()
    listing.names[i] = entry.name
    listing.kinds[i] = dir ? 1 : 0
    listing.sizes[i] = dir ? 0 : stat.size
    listing.mtimes[i] = Math.floor(stat.mtimeMs)
    listing.ctimes[i] = Math.floor(stat.birthtimeMs)
    listing.attrs[i] = dir ? DIRECTORY : 0
  })
  return listing
}
