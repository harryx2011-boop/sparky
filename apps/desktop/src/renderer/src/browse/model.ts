// Folder view model: column listing to rows, sorting (folders first, natural names), labels, densities and path helpers.
import type { FolderListing } from '@sparky/core'

const HIDDEN = 0x2

export interface Row {
  name: string
  dir: boolean
  ext: string
  size: number
  mtime: number
  hidden: boolean
}

export type SortKey = 'name' | 'modified' | 'type' | 'size'
export interface Sort {
  key: SortKey
  desc: boolean
}

export type ViewMode = 'details' | 'list' | 'grid'

export const DENSITIES = {
  compact: { label: 'Compact', row: 24, font: 12, tile: 96 },
  normal: { label: 'Normal', row: 30, font: 13, tile: 120 },
  roomy: { label: 'Roomy', row: 36, font: 14, tile: 148 },
} as const
export type Density = keyof typeof DENSITIES

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function toRows(listing: FolderListing): Row[] {
  return listing.names.map((name, i) => {
    const dir = listing.kinds[i] === 1
    return { name, dir, ext: dir ? '' : extOf(name), size: listing.sizes[i] ?? 0, mtime: listing.mtimes[i] ?? 0, hidden: ((listing.attrs[i] ?? 0) & HIDDEN) !== 0 }
  })
}

export function mergeListing(head: FolderListing, rest: FolderListing): FolderListing {
  const join = <T extends Uint8Array | Float64Array | Uint32Array>(a: T, b: T, make: new (n: number) => T): T => {
    const out = new make(a.length + b.length)
    out.set(a)
    out.set(b, a.length)
    return out
  }
  return {
    names: head.names.concat(rest.names),
    kinds: join(head.kinds, rest.kinds, Uint8Array),
    sizes: join(head.sizes, rest.sizes, Float64Array),
    mtimes: join(head.mtimes, rest.mtimes, Float64Array),
    ctimes: join(head.ctimes, rest.ctimes, Float64Array),
    attrs: join(head.attrs, rest.attrs, Uint32Array),
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  modified: (a, b) => a.mtime - b.mtime,
  size: (a, b) => a.size - b.size,
  type: (a, b) => collator.compare(a.ext, b.ext),
}

const nameOrders = new WeakMap<Row[], Row[]>()

function nameOrder(rows: Row[]): Row[] {
  let sorted = nameOrders.get(rows)
  if (!sorted) {
    sorted = [...rows].sort(COMPARE.name)
    nameOrders.set(rows, sorted)
  }
  return sorted
}

export function shownRows(rows: Row[], sort: Sort, showHidden: boolean): Row[] {
  const list = nameOrder(rows).filter((r) => showHidden || !r.hidden)
  if (sort.key === 'name') {
    if (sort.desc) list.reverse()
  } else {
    const by = COMPARE[sort.key]
    const sign = sort.desc ? -1 : 1
    list.sort((a, b) => sign * by(a, b))
  }
  return [...list.filter((r) => r.dir), ...list.filter((r) => !r.dir)]
}

export function typeLabel(row: Row): string {
  if (row.dir) return 'Folder'
  return row.ext ? `${row.ext.toUpperCase()} file` : 'File'
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function joinPath(folder: string, name: string): string {
  return folder.endsWith('\\') ? folder + name : `${folder}\\${name}`
}

export function parentOf(path: string): string | null {
  const trimmed = path.replace(/\\+$/, '')
  const cut = trimmed.lastIndexOf('\\')
  if (cut < 0) return null
  const parent = trimmed.slice(0, cut)
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent
}

export function folderName(path: string): string {
  const trimmed = path.replace(/\\+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('\\') + 1) || path
}
