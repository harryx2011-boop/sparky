// Captions to a transcript: the yt-dlp arguments that fetch only the caption file, and the WebVTT-to-text step.

export interface TranscriptContext {
  outputDir: string
  langs?: string[]
  ffmpegDir?: string
  jsRuntime?: string
}

/** yt-dlp arguments that save only the caption file: the uploader's captions, else the auto-generated ones. */
export function planTranscript(url: string, ctx: TranscriptContext): string[] {
  const args = [
    '--skip-download',
    '--no-playlist',
    '--write-subs',
    '--write-auto-subs',
    '--sub-format',
    'vtt',
    '--sub-langs',
    ctx.langs?.length ? ctx.langs.join(',') : 'en',
    '--no-warnings',
    '--ignore-errors',
    '--no-mtime',
    '--windows-filenames',
    '--encoding',
    'utf-8',
    '--no-colors',
    '-P',
    ctx.outputDir,
    '-o',
    '%(title).150B [%(id)s].%(ext)s',
  ]
  if (ctx.jsRuntime) args.push('--js-runtimes', ctx.jsRuntime)
  args.push('--', url)
  return args
}

/** yt-dlp reads each language as a regular expression that must match the whole code ("en.*" is en-US, en-GB); "all" is every language. */
function langMatches(lang: string, code: string): boolean {
  if (lang.toLowerCase() === code.toLowerCase()) return true
  try {
    return new RegExp(`^(?:${lang})$`, 'i').test(code)
  } catch {
    return false
  }
}

/** The caption file for the first language that has one (an exact code beats a pattern); the first file when no language was asked for, or for "all". */
export function pickCaptionFile(files: readonly string[], langs: readonly string[]): string | undefined {
  const vtt = files.filter((f) => /\.vtt$/i.test(f))
  if (!langs.length || langs.some((l) => l.toLowerCase() === 'all')) return vtt[0]
  const code = (f: string) => /\.([^.]+)\.vtt$/i.exec(f)?.[1] ?? ''
  for (const lang of langs) {
    const hit = vtt.find((f) => lang.toLowerCase() === code(f).toLowerCase()) ?? vtt.find((f) => langMatches(lang, code(f)))
    if (hit) return hit
  }
  return undefined
}

const CUE_TIME = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s*(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/

/** Auto captions put a near-instant cue between two others to repeat the line on screen; under this it is a transition, not speech. */
const TRANSITION_MS = 50

function cueLength(t: RegExpExecArray): number {
  const ms = (h: string | undefined, m: string, s: string, f: string) => ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(f)
  return ms(t[5], t[6]!, t[7]!, t[8]!) - ms(t[1], t[2]!, t[3]!, t[4]!)
}

function mark(h: string | undefined, m: string, s: string): string {
  return h && Number(h) > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Captions carry HTML entities (&amp;, &#39;); one pass, so "&amp;lt;" stays "&lt;". */
function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,6})|#x([0-9a-f]{1,6})|([a-z]+));/gi, (m, dec, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? m
    const code = dec ? Number(dec) : parseInt(hex, 16)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
  })
}

/** One entry per caption cue. Inline timing tags go, and a line the cue before already showed is kept once when the captions roll (a cue with two or more lines, or a near-instant cue, as auto captions have); a line a speaker repeats in two one-line cues stays. */
export function vttToText(vtt: string, timestamps = false): string {
  const entries: string[] = []
  let previous: string[] = []
  for (const block of vtt.replace(/^\uFEFF/, '').split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/)
    const at = lines.findIndex((l) => CUE_TIME.test(l))
    if (at < 0) continue
    const time = CUE_TIME.exec(lines[at]!)!
    const shown = lines
      .slice(at + 1)
      .map((l) => decodeEntities(l.replace(/<[^<>]*>/g, '')).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const rolling = previous.length > 1 || shown.length > 1 || cueLength(time) < TRANSITION_MS
    const fresh = rolling ? shown.filter((l) => !previous.includes(l)) : shown
    previous = shown
    if (!fresh.length) continue
    const text = fresh.join(' ')
    entries.push(timestamps ? `[${mark(time[1], time[2]!, time[3]!)}] ${text}` : text)
  }
  return entries.join('\n')
}
