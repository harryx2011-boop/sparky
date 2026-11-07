// List a folder (optionally a few levels down) with filters, a summary of everything that matched, and one page of rows.
import path from 'node:path'
import { globMatcher } from './glob'
import { ATTR, defaultLister, FilesError, listOrThrow, type Lister } from './lister'
import type { FileEntry, FolderSummary, ListQuery, ListResult, SortKey } from './types'

export const DEFAULT_LIMIT = 200
const TOP_EXTS = 5

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export const extOf = (name: string) => path.extname(name).slice(1).toLowerCase()

function dateMs(value: string | number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  const ms = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`\`${field}\` must be a date such as 2026-01-31.`)
  return ms
}

export function filter(q: ListQuery): (e: FileEntry) => boolean {
  const glob = q.glob ? globMatcher(q.glob) : null
  const exts = q.ext?.map((x) => x.replace(/^\./, '').toLowerCase())
  const after = dateMs(q.after, 'after')
  const before = dateMs(q.before, 'before')
  return (e) =>
    (!q.kind || e.kind === q.kind) &&
    (!glob || glob(path.basename(e.name), e.name)) &&
    (!exts || (e.kind === 'file' && exts.includes(extOf(e.name)))) &&
    (q.minSize === undefined || (e.kind === 'file' && e.size >= q.minSize)) &&
    (q.maxSize === undefined || (e.kind === 'file' && e.size <= q.maxSize)) &&
    (after === undefined || e.mtime >= after) &&
    (before === undefined || e.mtime < before)
}

const COMPARE: Record<SortKey, (a: FileEntry, b: FileEntry) => number> = {
  name: () => 0,
  size: (a, b) => a.size - b.size,
  modified: (a, b) => a.mtime - b.mtime,
  type: (a, b) => collator.compare(extOf(a.name), extOf(b.name)),
}

function sorted(entries: FileEntry[], key: SortKey, desc: boolean): FileEntry[] {
  const byName = entries.sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === 'dir' ? -1 : 1))
  if (key === 'name') return desc ? byName.reverse() : byName
  const cmp = COMPARE[key]
  return byName.sort((a, b) => (desc ? cmp(b, a) : cmp(a, b)))
}

function summarize(entries: FileEntry[]): FolderSummary {
  const counts = new Map<string, number>()
  let files = 0
  let bytes = 0
  for (const e of entries) {
    if (e.kind === 'dir') continue
    files++
    bytes += e.size
    const ext = extOf(e.name)
    if (ext) counts.set(ext, (counts.get(ext) ?? 0) + 1)
  }
  const exts = [...counts].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).slice(0, TOP_EXTS)
  return { files, dirs: entries.length - files, bytes, exts }
}

export function walk(lister: Lister, root: string, depth: number, hidden: boolean, onEntry: (e: FileEntry) => boolean): { skipped: number } {
  let skipped = 0
  let stopped = false
  const visit = (rel: string, level: number) => {
    let listing
    try {
      listing = listOrThrow(lister, rel ? path.join(root, rel) : root)
    } catch (err) {
      if (!rel) throw err
      if (err instanceof FilesError) return void skipped++
      throw err
    }
    for (let i = 0; i < listing.names.length && !stopped; i++) {
      const attrs = listing.attrs[i]!
      const isHidden = (attrs & (ATTR.hidden | ATTR.system)) !== 0
      if (isHidden && !hidden) continue
      const base = listing.names[i]!
      const name = rel ? path.join(rel, base) : base
      const kind = listing.kinds[i] === 1 ? 'dir' : 'file'
      const link = (attrs & ATTR.reparse) !== 0
      const entry: FileEntry = { name, kind, size: listing.sizes[i]!, mtime: listing.mtimes[i]!, ctime: listing.ctimes[i]!, hidden: isHidden, link }
      if (!onEntry(entry)) stopped = true
      else if (kind === 'dir' && !link && level < depth) visit(name, level + 1)
    }
  }
  visit('', 1)
  return { skipped }
}

export function listFiles(q: ListQuery, lister: Lister = defaultLister): ListResult {
  const depth = Math.max(1, Math.floor(q.depth ?? 1))
  const limit = Math.max(1, Math.floor(q.limit ?? DEFAULT_LIMIT))
  const start = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0
  const keep = filter(q)
  const hits: FileEntry[] = []
  const { skipped } = walk(lister, q.path, depth, q.hidden ?? false, (e) => (keep(e) && hits.push(e), true))
  const matched = sorted(hits, q.sort ?? 'name', q.desc ?? false)
  const end = start + limit
  return {
    path: q.path,
    summary: summarize(matched),
    entries: matched.slice(start, end),
    ...(end < matched.length ? { next: String(end) } : {}),
    skipped,
  }
}
