// Browser preview folders: a made-up tree so the folder views can be seen without the app; C:\Big holds 100,000 files.
import type { FolderListResult, Places } from '@sparky/core'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 7)
const EXTS = ['mp4', 'jpg', 'png', 'pdf', 'docx', 'mp3', 'zip', 'heic', 'mov', 'txt']
const DIRS = ['Projects', 'Photos', 'Invoices', 'Music', 'Screenshots']

export function mockList(path: string): FolderListResult {
  if (/\\Locked$/i.test(path)) return { ok: false, path, code: 'EACCES', message: 'Access to this folder was refused.' }
  const big = path.toLowerCase() === 'c:\\big'
  const dirs = big || path.split('\\').length > 4 ? [] : /^[A-Z]:\\$/i.test(path) ? ['Big', ...DIRS] : DIRS
  const files = big ? 100_000 : 24 + (path.length % 30)
  const n = dirs.length + files + 1
  const head = { names: [] as string[], kinds: new Uint8Array(n), sizes: new Float64Array(n), mtimes: new Float64Array(n), ctimes: new Float64Array(n), attrs: new Uint32Array(n) }
  dirs.forEach((name, i) => {
    head.names.push(name)
    head.kinds[i] = 1
    head.attrs[i] = 0x10
    head.mtimes[i] = NOW - i * DAY
  })
  for (let f = 0; f < files; f++) {
    const i = dirs.length + f
    head.names.push(`${big ? 'frame' : 'file'} ${f + 1}.${EXTS[f % EXTS.length]}`)
    head.sizes[i] = ((f * 7919) % 5000) * 1024 + 300
    head.mtimes[i] = NOW - ((f * 31) % 400) * DAY
  }
  head.names.push('desktop.ini')
  head.attrs[n - 1] = 0x2 | 0x4
  return { ok: true, path, head, total: n, rest: null }
}

export const MOCK_PLACES: Places = {
  quick: [
    { label: 'Desktop', path: 'C:\\Users\\you\\Desktop', icon: 'desktop' },
    { label: 'Downloads', path: 'C:\\Users\\you\\Downloads', icon: 'downloads' },
    { label: 'Documents', path: 'C:\\Users\\you\\Documents', icon: 'documents' },
    { label: 'Pictures', path: 'C:\\Users\\you\\Pictures', icon: 'pictures' },
    { label: 'Sparky', path: 'C:\\Users\\you\\Downloads\\Sparky', icon: 'sparky' },
  ],
  drives: [
    { label: 'C:', path: 'C:\\', icon: 'drive' },
    { label: 'D:', path: 'D:\\', icon: 'drive' },
  ],
}
