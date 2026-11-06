// Folder listing as columns: the compiled addon when it loads, Node's fs otherwise (ADR 0002).
import { createRequire } from 'node:module'
import { listFallback } from './fallback'
import type { Listing } from './types'

export type { Listing, ListErrorCode } from './types'
export { listFallback } from './fallback'

const require = createRequire(import.meta.url)

function load(): ((path: string) => Listing) | null {
  try {
    return (require('../build/Release/fs_native.node') as { list: (path: string) => Listing }).list
  } catch {
    return null
  }
}

const addon = load()

export const native = addon !== null

export function list(path: string): Listing {
  return addon ? addon(path) : listFallback(path)
}
