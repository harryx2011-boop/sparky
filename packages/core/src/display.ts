// Small helpers for showing sizes, times and savings.

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(1)} ${units[i]}`
}

export function formatSpeed(bytesPerSecond: number | undefined): string | undefined {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond)) return undefined
  return `${formatBytes(bytesPerSecond)}/s`
}

/** 3725 → "1:02:05", 42 → "0:42" */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function formatEta(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined
  return `${formatDuration(seconds)} left`
}

/** Percent saved, e.g. 318 MB → 96 MB gives 70. Negative when the file grew. */
export function savedPercent(before: number | undefined, after: number | undefined): number | undefined {
  if (!before || after === undefined || before <= 0) return undefined
  return Math.round((1 - after / before) * 100)
}

export function describeSaving(before: number | undefined, after: number | undefined): string | undefined {
  const pct = savedPercent(before, after)
  if (pct === undefined) return undefined
  const sizes = `${formatBytes(before)} → ${formatBytes(after)}`
  if (pct > 0) return `${sizes} · ${pct}% smaller`
  if (pct < 0) return `${sizes} · ${-pct}% larger`
  return `${sizes} · same size`
}

/** Parses "1:30", "90", "01:02:03" or "1m30s" into seconds. */
export function parseTime(text: string): number | undefined {
  const t = text.trim()
  if (!t) return undefined
  const hms = /^(\d+h)?\s*(\d+m)?\s*(\d+(?:\.\d+)?s)?$/i.exec(t)
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return (parseInt(hms[1] ?? '0') * 3600) + (parseInt(hms[2] ?? '0') * 60) + parseFloat(hms[3] ?? '0')
  }
  const parts = t.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined
  return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0)
}

/** "clip.mov" + "mp4" → "clip.mp4"; adds " (2)" etc. when the name is taken. */
export function outputName(inputName: string, ext: string, taken: (name: string) => boolean, suffix = ''): string {
  const dot = inputName.lastIndexOf('.')
  const base = (dot > 0 ? inputName.slice(0, dot) : inputName) + suffix
  const extPart = ext === 'folder' ? '' : `.${ext}`
  let name = `${base}${extPart}`
  for (let n = 2; taken(name); n++) name = `${base} (${n})${extPart}`
  return name
}
