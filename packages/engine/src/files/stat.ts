// Facts about many paths in one call. Each parent folder is listed once, so the flags match what a listing shows.
import type { Listing } from '@sparky/fs-native'
import fs from 'node:fs'
import path from 'node:path'
import { extOf } from './list'
import { ATTR, defaultLister, type Lister } from './lister'
import type { StatResult } from './types'

interface Parent {
  listing: Listing | null
  index: Map<string, number>
}

function rootStat(p: string): StatResult {
  try {
    const s = fs.statSync(p)
    return { path: p, kind: 'dir', size: 0, mtime: Math.floor(s.mtimeMs), ctime: Math.floor(s.birthtimeMs), ext: '', hidden: false, readonly: false, link: false }
  } catch {
    return { path: p, kind: 'missing' }
  }
}

function readParent(lister: Lister, dir: string): Parent {
  try {
    const listing = lister(dir)
    return { listing, index: new Map(listing.names.map((n, i) => [n.toLowerCase(), i])) }
  } catch {
    return { listing: null, index: new Map() }
  }
}

export function statFiles(paths: string[], lister: Lister = defaultLister): StatResult[] {
  const parents = new Map<string, Parent>()
  return paths.map((p) => {
    const abs = path.resolve(p)
    const dir = path.dirname(abs)
    if (dir === abs) return rootStat(p)
    const key = dir.toLowerCase()
    let parent = parents.get(key)
    if (!parent) parents.set(key, (parent = readParent(lister, dir)))
    const i = parent.index.get(path.basename(abs).toLowerCase())
    const l = parent.listing
    if (i === undefined || !l) return { path: p, kind: 'missing' }
    const attrs = l.attrs[i]!
    const kind = l.kinds[i] === 1 ? 'dir' : 'file'
    return {
      path: p,
      kind,
      size: l.sizes[i]!,
      mtime: l.mtimes[i]!,
      ctime: l.ctimes[i]!,
      ext: kind === 'file' ? extOf(l.names[i]!) : '',
      hidden: (attrs & (ATTR.hidden | ATTR.system)) !== 0,
      readonly: (attrs & ATTR.readonly) !== 0,
      link: (attrs & ATTR.reparse) !== 0,
    }
  })
}
