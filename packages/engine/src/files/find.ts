// Find files by name under a folder, the whole tree by default. Stops once the page is full, so a big drive answers fast.
import path from 'node:path'
import { DEFAULT_LIMIT, filter, walk } from './list'
import { defaultLister, type Lister } from './lister'
import type { FileEntry, FindQuery, FindResult } from './types'

const UNLIMITED_DEPTH = Number.MAX_SAFE_INTEGER

export function findFiles(q: FindQuery, lister: Lister = defaultLister): FindResult {
  const limit = Math.max(1, Math.floor(q.limit ?? DEFAULT_LIMIT))
  const start = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0
  const text = q.text?.toLowerCase()
  const keep = filter(q)
  const hits: FileEntry[] = []
  let seen = 0
  let more = false
  const { skipped } = walk(lister, q.path, q.depth ?? UNLIMITED_DEPTH, q.hidden ?? false, (e) => {
    if (text && !path.basename(e.name).toLowerCase().includes(text)) return true
    if (!keep(e)) return true
    if (seen++ < start) return true
    if (hits.length === limit) return !(more = true)
    hits.push(e)
    return true
  })
  return { path: q.path, entries: hits, ...(more ? { next: String(start + limit) } : {}), skipped }
}
