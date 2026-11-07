// The one place file reads touch the disk: the native lister, or Node fs with one warning when the addon did not load.
import { list, native, type Listing } from '@sparky/fs-native'

export type Lister = (path: string) => Listing

export const ATTR = { readonly: 0x1, hidden: 0x2, system: 0x4, reparse: 0x400 } as const

const MESSAGES: Record<string, string> = {
  EACCES: 'Access to this folder was refused.',
  EPERM: 'Access to this folder was refused.',
  ENOENT: "That folder doesn't exist.",
  ENOTDIR: "That isn't a folder.",
}

export class FilesError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: string,
  ) {
    super(`${MESSAGES[code] ?? "This folder couldn't be opened."} (${path})`)
    this.name = 'FilesError'
  }
}

let warned = false

export const defaultLister: Lister = (path) => {
  if (!native && !warned) {
    warned = true
    console.warn('[sparky] fs-native did not load; listing with Node fs (slower, no hidden or read-only flags).')
  }
  return list(path)
}

export function listOrThrow(lister: Lister, path: string): Listing {
  try {
    return lister(path)
  } catch (err) {
    throw new FilesError((err as NodeJS.ErrnoException).code ?? 'EIO', path)
  }
}
