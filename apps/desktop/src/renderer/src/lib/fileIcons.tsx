import { extOf, FileIcon, PACK_ONLY_EXTS, type FileFamily } from '@sparky/ui'
import { useEffect, useState } from 'react'
import { api } from './api'

/** Resolved icons, and lookups still on their way, shared by every row for the session. */
const known = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

function request(ext: string): Promise<string | null> {
  let p = pending.get(ext)
  if (!p) {
    p = api.icons
      .forExt(ext)
      .catch(() => null)
      .then((src) => {
        known.set(ext, src)
        pending.delete(ext)
        return src
      })
    pending.set(ext, p)
  }
  return p
}

/** The icon Windows gives this extension: a data URL, null when the pack should draw it, undefined while asking. */
export function useFileIcon(ext: string): string | null | undefined {
  const key = extOf(ext)
  const packOnly = PACK_ONLY_EXTS.has(key)
  const [src, setSrc] = useState(() => (packOnly ? null : known.get(key)))
  useEffect(() => {
    if (packOnly) return setSrc(null)
    if (known.has(key)) return setSrc(known.get(key))
    setSrc(undefined)
    let live = true
    void request(key).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [key, packOnly])
  return src
}

/** A file-type icon: the Windows association when there is one, else the bundled pack. Holds its space while asking. */
export function ExtIcon({ ext, size = 16, family, className }: { ext: string; size?: number; family?: FileFamily; className?: string }) {
  const src = useFileIcon(ext)
  if (src === undefined) return <span aria-hidden className={className} style={{ width: size, height: size, flexShrink: 0, display: 'inline-block' }} />
  return <FileIcon ext={ext} size={size} src={src} family={family} className={className} />
}
