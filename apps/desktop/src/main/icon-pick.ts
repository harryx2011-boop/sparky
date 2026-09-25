// The Electron-free half of the file-icon lookup, so it can be unit-tested.
import { createHash } from 'node:crypto'

const SAFE_EXT = /^[a-z0-9][a-z0-9_-]{0,15}$/
/** No program claims this, so its icon is the one Windows shows for "unknown type". */
export const NONSENSE_EXT = 'sparky-no-such-ext'

/** What Windows gave for one extension; null when asking it failed. */
export type IconShot = { png: Buffer; blank: boolean } | null

/** `retry` answers null now but must not be cached, so the next ask tries again. */
export type IconDecision = { kind: 'icon'; dataUrl: string } | { kind: 'none' } | { kind: 'retry' }

/** The extension to probe, lower case without the dot, or null when it is not safe to put in a file name. */
export function iconExt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const ext = raw.trim().toLowerCase().replace(/^\./, '')
  return SAFE_EXT.test(ext) && ext !== NONSENSE_EXT ? ext : null
}

export function hashPng(png: Buffer): string {
  return createHash('sha256').update(png).digest('hex')
}

/** `genericHash` is the hash of the unknown-type icon, or null when that baseline could not be read. */
export function decideIcon(shot: IconShot, genericHash: string | null): IconDecision {
  if (shot === null) return { kind: 'retry' }
  if (shot.blank) return { kind: 'none' }
  // Without a baseline an unassociated type would pass as real.
  if (genericHash === null) return { kind: 'retry' }
  if (hashPng(shot.png) === genericHash) return { kind: 'none' }
  return { kind: 'icon', dataUrl: `data:image/png;base64,${shot.png.toString('base64')}` }
}
