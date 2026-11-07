// Places for the window: the Windows known folders, Sparky's output folder and the drive roots that exist.
import type { Place } from '@sparky/core'

const KNOWN = [
  { label: 'Desktop', name: 'desktop', icon: 'desktop' },
  { label: 'Downloads', name: 'downloads', icon: 'downloads' },
  { label: 'Documents', name: 'documents', icon: 'documents' },
  { label: 'Pictures', name: 'pictures', icon: 'pictures' },
] as const

export function quickAccess(getPath: (name: (typeof KNOWN)[number]['name']) => string, outputRoot: string): Place[] {
  return [...KNOWN.map(({ label, name, icon }) => ({ label, path: getPath(name), icon })), { label: 'Sparky', path: outputRoot, icon: 'sparky' }]
}

export function drives(exists: (root: string) => boolean): Place[] {
  const found: Place[] = []
  for (let c = 65; c <= 90; c++) {
    const root = `${String.fromCharCode(c)}:\\`
    if (exists(root)) found.push({ label: root.slice(0, 2), path: root, icon: 'drive' })
  }
  return found
}
