// File-type icons from the user's own Windows associations, as PNG data URLs for the renderer.
// Windows resolves an association from the extension alone, so the probe path never has to exist.
import { app, type IpcMain, type NativeImage } from 'electron'
import path from 'node:path'
import { decideIcon, hashPng, iconExt, NONSENSE_EXT, type IconShot } from './icon-pick'

const cache = new Map<string, Promise<string | null>>()
let genericHash: Promise<string | null> | undefined

function isBlank(img: NativeImage): boolean {
  if (img.isEmpty()) return true
  const bgra = img.toBitmap()
  for (let i = 3; i < bgra.length; i += 4) if (bgra[i]! > 0) return false
  return true
}

async function shoot(ext: string): Promise<IconShot> {
  try {
    const img = await app.getFileIcon(path.join(app.getPath('temp'), `sparky-icon-probe.${ext}`), { size: 'large' })
    const blank = isBlank(img)
    return { png: blank ? Buffer.alloc(0) : img.toPNG(), blank }
  } catch {
    return null
  }
}

async function generic(): Promise<string | null> {
  genericHash ??= shoot(NONSENSE_EXT).then((s) => (s && !s.blank ? hashPng(s.png) : null))
  const hash = await genericHash
  if (hash === null) genericHash = undefined
  return hash
}

async function lookup(ext: string): Promise<string | null> {
  const shot = await shoot(ext)
  const decision = decideIcon(shot, shot && !shot.blank ? await generic() : null)
  if (decision.kind === 'retry') cache.delete(ext)
  return decision.kind === 'icon' ? decision.dataUrl : null
}

/** A data URL for the icon Windows shows for this extension, or null when it has no specific one. Never throws. */
export function iconForExt(raw: unknown): Promise<string | null> {
  const ext = iconExt(raw)
  if (!ext) return Promise.resolve(null)
  let hit = cache.get(ext)
  if (!hit) {
    hit = lookup(ext).catch(() => {
      cache.delete(ext)
      return null
    })
    cache.set(ext, hit)
  }
  return hit
}

export function registerIconIpc(ipc: IpcMain): void {
  ipc.handle('icons:forExt', (_e, ext: unknown) => iconForExt(ext))
}
