// Folder listing for the window: the first rows at once, the rest on request, plain error text, live change events.
import type { FolderListing, FolderListResult, Places } from '@sparky/core'
import { list } from '@sparky/fs-native'
import { randomUUID } from 'node:crypto'
import { watch } from 'node:fs'
import type { IpcMain, WebContents } from 'electron'

export const HEAD_ROWS = 200
const REST_TTL_MS = 60_000
const SETTLE_MS = 50

const MESSAGES: Record<string, string> = {
  EACCES: 'Access to this folder was refused.',
  EPERM: 'Access to this folder was refused.',
  ENOENT: "That folder doesn't exist.",
  ENOTDIR: "That isn't a folder.",
}

const rests = new Map<string, FolderListing>()

function rows(listing: FolderListing, start: number, end?: number): FolderListing {
  return {
    names: listing.names.slice(start, end),
    kinds: listing.kinds.slice(start, end),
    sizes: listing.sizes.slice(start, end),
    mtimes: listing.mtimes.slice(start, end),
    ctimes: listing.ctimes.slice(start, end),
    attrs: listing.attrs.slice(start, end),
  }
}

export function listFolder(path: string): FolderListResult {
  let listing: FolderListing
  try {
    listing = list(path)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'EIO'
    return { ok: false, path, code, message: MESSAGES[code] ?? "This folder couldn't be opened." }
  }
  const total = listing.names.length
  if (total <= HEAD_ROWS) return { ok: true, path, head: listing, total, rest: null }
  const rest = randomUUID()
  rests.set(rest, rows(listing, HEAD_ROWS))
  setTimeout(() => rests.delete(rest), REST_TTL_MS).unref()
  return { ok: true, path, head: rows(listing, 0, HEAD_ROWS), total, rest }
}

export function takeRest(id: string): FolderListing | null {
  const rest = rests.get(id) ?? null
  rests.delete(id)
  return rest
}

export function watchFolder(path: string, onChange: () => void): () => void {
  let timer: NodeJS.Timeout | undefined
  const settle = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, SETTLE_MS)
  }
  const watcher = watch(path, { persistent: false }, settle)
  watcher.on('error', () => {
    watcher.close()
    settle()
  })
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}

export function registerFsIpc(ipc: IpcMain, places: () => Places): void {
  ipc.handle('folders:places', () => places())
  const watchers = new Map<string, () => void>()
  const stop = (id: string) => {
    watchers.get(id)?.()
    watchers.delete(id)
  }
  ipc.handle('folders:list', (_e, path: string) => listFolder(path))
  ipc.handle('folders:rest', (_e, id: string) => takeRest(id))
  ipc.handle('folders:watch', (e, path: string) => {
    const id = randomUUID()
    const sender: WebContents = e.sender
    watchers.set(id, watchFolder(path, () => {
      if (!sender.isDestroyed()) sender.send('folders:change', id)
    }))
    sender.once('destroyed', () => stop(id))
    return id
  })
  ipc.handle('folders:unwatch', (_e, id: string) => stop(id))
}
