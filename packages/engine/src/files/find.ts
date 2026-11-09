// Find files by name under a folder, the whole tree by default. Stops once the page is full or the time budget runs out, so a big drive still answers.
import path from 'node:path'
import { DEFAULT_LIMIT, filter, walk } from './list'
import { defaultLister, type Lister } from './lister'
import type { FileEntry, FindQuery, FindResult } from './types'

const UNLIMITED_DEPTH = Number.MAX_SAFE_INTEGER
export const DEFAULT_FIND_MS = 20_000

export function findFiles(q: FindQuery, lister: Lister = defaultLister): FindResult {
  const limit = Math.max(1, Math.floor(q.limit ?? DEFAULT_LIMIT))
  const start = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0
  const text = q.text?.toLowerCase()
  const keep = filter(q)
  const hits: FileEntry[] = []
  let seen = 0
  let more = false
  let timedOut = false
  const t0 = Date.now()
  const deadline = t0 + Math.max(0, q.timeoutMs ?? DEFAULT_FIND_MS)
  const { skipped } = walk(lister, q.path, q.depth ?? UNLIMITED_DEPTH, q.hidden ?? false, (e) => {
    if (Date.now() >= deadline) return !(timedOut = true)
    if (text && !path.basename(e.name).toLowerCase().includes(text)) return true
    if (!keep(e)) return true
    if (seen++ < start) return true
    if (hits.length === limit) return !(more = true)
    hits.push(e)
    return true
  })
  const next = timedOut ? start + hits.length : more ? start + limit : undefined
  return { path: q.path, entries: hits, ...(next !== undefined ? { next: String(next) } : {}), skipped, ...(timedOut ? { timedOut: true as const } : {}), elapsedMs: Date.now() - t0 }
}
