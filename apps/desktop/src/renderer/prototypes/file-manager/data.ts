// Comp fixture: real listing of Downloads\Sparky\uxpeak and the real mp4 convert targets (2026-11-06).

export interface Entry {
  name: string
  kind: 'dir' | 'file'
  ext: string
  size: number
  modified: string
}

const video = (name: string, size: number, modified: string): Entry => ({ name, kind: 'file', ext: 'mp4', size, modified })
const dir = (name: string): Entry => ({ name, kind: 'dir', ext: '', size: 0, modified: '2026-10-25 02:09' })

export const FOLDER = { path: ['This PC', 'Downloads', 'Sparky', 'uxpeak'], name: 'uxpeak' }

export const ENTRIES: Entry[] = [
  dir('audio'),
  dir('sheets'),
  dir('transcripts'),
  video('Ecommerce Page Redesign： UX⧸UI Tips to 3.5x Conversion [oYskl2ZBoBc].mp4', 16379888, '2026-10-09 18:04'),
  video('The Same App Designed By An $80K vs $250K UX⧸UI Designer [U7jTCgIWS4w].mp4', 46929726, '2026-10-09 18:06'),
  video('The UX Psychology Behind Apps People Can’t Stop Using [2TlIg3VokY8].mp4', 24369701, '2026-10-09 18:04'),
  video('This UI⧸UX Redesign Will Teach You More Than 100 Tutorials Combined [GGg61sdEjeI].mp4', 36096710, '2026-10-09 18:04'),
  video('Top 3 UX⧸UI Redesigns That Make You Design Like a Pro [zr37ibqXl1U].mp4', 29477291, '2026-10-09 18:04'),
]

export const SELECTED = 4

export const SELECTED_DETAILS = { duration: '14:52', dimensions: '1920 × 1080', frameRate: '30 fps', source: 'youtube.com' }

export const TABS = ['uxpeak', 'one-more-morning', 'sparky']

export interface Place {
  label: string
  icon: string
  hint?: string
}

export const PLACES: { title: string; items: Place[] }[] = [
  { title: 'Quick Access', items: [{ label: 'Desktop', icon: 'monitor' }, { label: 'Downloads', icon: 'download' }, { label: 'Documents', icon: 'file-text' }, { label: 'Sparky', icon: 'bolt', hint: 'output' }] },
  { title: 'Drives', items: [{ label: 'Local Disk (C:)', icon: 'drive', hint: '212 GB free' }, { label: 'Data (D:)', icon: 'drive', hint: '1.4 TB free' }] },
  { title: 'Sparky', items: [{ label: 'Convert', icon: 'convert' }, { label: 'Download', icon: 'link' }, { label: 'Tools', icon: 'wrench' }, { label: 'Queue', icon: 'queue', hint: '1' }, { label: 'History', icon: 'history' }] },
]

export const TARGETS = {
  video: ['mp4', 'webm', 'mkv', 'mov', 'gif'],
  audio: ['mp3', 'm4a', 'wav', 'flac', 'ogg'],
}

export const RECENT_TARGET = 'gif'

export const JOB = { label: 'Shrinking stickman-sample.mp4', progress: 64 }

export function formatSize(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
