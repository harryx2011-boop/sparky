// The Electron-free half of the file-icon lookup, so it can be unit-tested.
import { createHash } from 'node:crypto'

const SAFE_EXT = /^[a-z0-9][a-z0-9_-]{0,15}$/
export const NONSENSE_EXT = 'sparky-no-such-ext'

export type IconShot = { png: Buffer; blank: boolean } | null

export type IconDecision = { kind: 'icon'; dataUrl: string } | { kind: 'none' } | { kind: 'retry' }

export function iconExt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const ext = raw.trim().toLowerCase().replace(/^\./, '')
  return SAFE_EXT.test(ext) && ext !== NONSENSE_EXT ? ext : null
}

export function hashPng(png: Buffer): string {
  return createHash('sha256').update(png).digest('hex')
}

export function decideIcon(shot: IconShot, genericHash: string | null): IconDecision {
  if (shot === null) return { kind: 'retry' }
  if (shot.blank) return { kind: 'none' }
  if (genericHash === null) return { kind: 'retry' }
  if (hashPng(shot.png) === genericHash) return { kind: 'none' }
  return { kind: 'icon', dataUrl: `data:image/png;base64,${shot.png.toString('base64')}` }
}
