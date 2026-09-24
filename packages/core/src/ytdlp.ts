// Builds yt-dlp command lines, reads link previews and progress.
import { compressionInfo } from './levels'
import { formatInfo, normalizeExt } from './formats'
import type { DownloadRequest, LinkEntry, LinkInfo } from './jobs'

/** Sites we recognise in the clipboard. Any link can still be pasted by hand. */
const KNOWN_HOSTS = [
  'youtube.com', 'youtu.be', 'vimeo.com', 'soundcloud.com', 'twitch.tv', 'tiktok.com', 'x.com',
  'twitter.com', 'instagram.com', 'reddit.com', 'dailymotion.com', 'bandcamp.com', 'facebook.com',
  'fb.watch', 'bilibili.com', 'kick.com', 'rumble.com', 'streamable.com', 'archive.org',
  'nicovideo.jp', 'mixcloud.com', 'bsky.app', 'threads.net', 'pinterest.com', 'vk.com', 'odysee.com',
  'ted.com', 'nebula.tv', 'bitchute.com', 'imgur.com', 'tumblr.com', 'loom.com',
]

/** Returns a clean URL when the text is a single http(s) link, otherwise undefined. */
export function asLink(text: string): string | undefined {
  const t = text.trim()
  if (!t || /\s/.test(t) || t.length > 2048) return undefined
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    if (!u.hostname.includes('.')) return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

/** True for links from sites we know yt-dlp handles well. Used for the clipboard chip. */
export function isKnownMediaLink(text: string): boolean {
  const url = asLink(text)
  if (!url) return false
  const host = new URL(url).hostname.replace(/^www\.|^m\.|^music\./, '')
  return KNOWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

export function inspectArgs(url: string, jsRuntime?: string): string[] {
  return [
    '--dump-single-json',
    '--flat-playlist',
    // Windows pipes default to the ANSI code page, which drops non-Latin titles.
    '--encoding',
    'utf-8',
    '--no-warnings',
    '--no-colors',
    ...(jsRuntime ? ['--js-runtimes', jsRuntime] : []),
    '--',
    url,
  ]
}

interface RawFormat {
  height?: number | null
  vcodec?: string | null
  acodec?: string | null
  filesize?: number | null
  filesize_approx?: number | null
}

interface RawInfo {
  _type?: string
  id?: string
  title?: string
  uploader?: string
  channel?: string
  playlist_uploader?: string
  thumbnail?: string
  thumbnails?: { url?: string; height?: number }[]
  duration?: number | null
  webpage_url?: string
  original_url?: string
  extractor_key?: string
  height?: number | null
  formats?: RawFormat[]
  subtitles?: Record<string, unknown>
  entries?: ({ id?: string; title?: string; duration?: number | null; url?: string; webpage_url?: string } | null)[]
}

/** Turns `yt-dlp -J --flat-playlist` output into the preview card data. */
export function parseLinkInfo(json: string, url: string): LinkInfo {
  const raw = JSON.parse(json) as RawInfo
  const isPlaylist = raw._type === 'playlist' || Array.isArray(raw.entries)
  const thumbnail =
    raw.thumbnail ??
    [...(raw.thumbnails ?? [])].filter((t) => t.url).sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0]?.url

  if (isPlaylist) {
    const entries: LinkEntry[] = (raw.entries ?? []).flatMap((e, i) =>
      e
        ? [{ index: i + 1, id: e.id ?? String(i + 1), title: e.title ?? `Item ${i + 1}`, duration: e.duration ?? undefined, url: e.webpage_url ?? e.url }]
        : [],
    )
    const total = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0)
    return {
      url,
      kind: 'playlist',
      title: raw.title ?? 'Playlist',
      uploader: raw.playlist_uploader ?? raw.uploader ?? raw.channel,
      thumbnail,
      duration: total > 0 ? total : undefined,
      entries,
      subtitleLangs: [],
      extractor: raw.extractor_key,
    }
  }

  const formats = raw.formats ?? []
  const videoFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
  const maxHeight = videoFormats.reduce((m, f) => Math.max(m, f.height ?? 0), raw.height ?? 0) || undefined
  const size = (f?: RawFormat) => f?.filesize ?? f?.filesize_approx ?? 0
  const bestVideo = [...videoFormats].sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || size(b) - size(a))[0]
  const bestAudio = formats
    .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
    .sort((a, b) => size(b) - size(a))[0]
  const estimate = size(bestVideo) + size(bestAudio)

  return {
    url,
    kind: 'single',
    title: raw.title ?? url,
    uploader: raw.uploader ?? raw.channel,
    thumbnail,
    duration: raw.duration ?? undefined,
    maxHeight,
    sizeEstimate: estimate > 0 ? estimate : undefined,
    entries: [],
    subtitleLangs: Object.keys(raw.subtitles ?? {}).filter((l) => l !== 'live_chat'),
    extractor: raw.extractor_key,
  }
}

export const PROGRESS_PREFIX = 'SPARKY|'
export const FILE_PREFIX = 'SPARKYFILE|'

const AUDIO_TARGETS = new Set(['mp3', 'm4a', 'flac', 'wav', 'ogg'])

export interface YtDlpContext {
  outputDir: string
  ffmpegDir?: string
  /** e.g. "deno:C:\\...\\deno.exe" */
  jsRuntime?: string
}

export interface YtDlpPlan {
  args: string[]
  /** Set when Sparky should convert the finished file itself as a second stage. */
  convertAfter?: string
}

/** Whether yt-dlp can finish the job alone (audio extraction) or Sparky converts afterwards. */
export function planDownload(req: DownloadRequest, ctx: YtDlpContext): YtDlpPlan {
  const comp = compressionInfo(req.compression)
  const target = req.convertTo ? normalizeExt(req.convertTo) : undefined
  const args: string[] = [
    '--newline',
    '--progress',
    '--encoding',
    'utf-8',
    '--no-colors',
    '--no-warnings',
    '--ignore-errors',
    '--no-mtime',
    '--windows-filenames',
    '--progress-template',
    `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.playlist_autonumber)s`,
    '--progress-template',
    `postprocess:${PROGRESS_PREFIX}pp|%(progress.postprocessor)s|%(progress.status)s`,
    '--print',
    `after_move:${FILE_PREFIX}%(filepath)s`,
    '-P',
    ctx.outputDir,
    '-o',
    // Playlist items go in a folder named after the playlist; single videos stay flat.
    '%(playlist_title&{}/|)s%(playlist_index&{} - |)s%(title).150B [%(id)s].%(ext)s',
  ]
  if (ctx.ffmpegDir) args.push('--ffmpeg-location', ctx.ffmpegDir)
  if (ctx.jsRuntime) args.push('--js-runtimes', ctx.jsRuntime)
  if (req.items && req.items.length > 0) args.push('--playlist-items', req.items.join(','))

  let convertAfter: string | undefined
  if (req.mode === 'audio') {
    const audio = target && AUDIO_TARGETS.has(target) ? target : 'mp3'
    args.push('-f', 'ba/b', '-x', '--audio-format', audio)
    if (audio !== 'wav' && audio !== 'flac') args.push('--audio-quality', `${comp.audioKbps}K`)
    if (target && !AUDIO_TARGETS.has(target)) convertAfter = target
  } else {
    const h = req.quality
    args.push('-f', 'bv*+ba/b', '-S', h ? `res:${h},ext:mp4:m4a` : 'ext:mp4:m4a', '--merge-output-format', 'mp4')
    // Converting to MP4 still runs a second pass, which applies the Compression level.
    if (target) convertAfter = target
  }

  const e = req.extras
  if (e.thumbnail) args.push('--embed-thumbnail')
  if (e.metadata) args.push('--embed-metadata', '--embed-chapters')
  if (e.subtitles !== 'off') {
    args.push('--write-subs', '--sub-langs', e.subtitleLangs.length ? e.subtitleLangs.join(',') : 'en')
    if (e.subtitles === 'embed' && req.mode === 'video') args.push('--embed-subs')
  }
  if (e.sponsorBlock) args.push('--sponsorblock-remove', 'sponsor,intro,selfpromo')

  args.push('--', req.url)
  return { args, convertAfter }
}

export interface DownloadProgress {
  kind: 'download'
  downloaded: number
  total?: number
  /** Bytes per second. */
  speed?: number
  eta?: number
  /** 1-based count of the item being downloaded in this run. */
  item?: number
}

export interface PostprocessProgress {
  kind: 'postprocess'
  name: string
  status: string
}

const num = (s: string | undefined) => {
  if (s === undefined || s === 'NA' || s === 'None' || s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function parseYtDlpLine(line: string): DownloadProgress | PostprocessProgress | { kind: 'file'; path: string } | undefined {
  const l = line.trim()
  if (l.startsWith(FILE_PREFIX)) return { kind: 'file', path: l.slice(FILE_PREFIX.length) }
  if (!l.startsWith(PROGRESS_PREFIX)) return undefined
  const parts = l.slice(PROGRESS_PREFIX.length).split('|')
  if (parts[0] === 'pp') return { kind: 'postprocess', name: parts[1] ?? '', status: parts[2] ?? '' }
  const [downloaded, total, estimate, speed, eta, item] = parts
  return {
    kind: 'download',
    downloaded: num(downloaded) ?? 0,
    total: num(total) ?? num(estimate),
    speed: num(speed),
    eta: num(eta),
    item: num(item),
  }
}

/** Friendly names for yt-dlp's post-processing steps. */
export function postprocessLabel(name: string): string {
  if (/ExtractAudio/i.test(name)) return 'Converting audio'
  if (/Merger/i.test(name)) return 'Joining video and sound'
  if (/EmbedThumbnail/i.test(name)) return 'Adding cover art'
  if (/Metadata/i.test(name)) return 'Adding tags'
  if (/Subtitle/i.test(name)) return 'Adding subtitles'
  if (/SponsorBlock|ModifyChapters/i.test(name)) return 'Cutting sponsor segments'
  return 'Finishing up'
}

export interface YtDlpError {
  message: string
  suggestUpdate: boolean
}

/** Turns yt-dlp's stderr into a short message and says whether an update might fix it. */
export function explainYtDlpError(stderr: string): YtDlpError {
  const lines = stderr.split(/\r?\n/).filter((l) => l.startsWith('ERROR:'))
  const raw = (lines[lines.length - 1] ?? stderr.trim().split(/\r?\n/).pop() ?? '').replace(/^ERROR:\s*(\[[^\]]+\]\s*)?(\S+:\s*)?/, '')
  if (/Unsupported URL/i.test(raw)) return { message: "This site isn't supported yet.", suggestUpdate: true }
  if (/Sign in to confirm|age|log ?in|private video|members-only/i.test(raw))
    return { message: 'This video needs you to be signed in, so it can’t be downloaded.', suggestUpdate: false }
  if (/Video unavailable|removed|does not exist|404/i.test(raw)) return { message: 'This video is unavailable or was removed.', suggestUpdate: false }
  if (/Requested format is not available/i.test(raw)) return { message: 'That quality isn’t offered for this video. Try a lower one.', suggestUpdate: false }
  if (/getaddrinfo|Unable to download (webpage|API page)|timed out|Connection|proxy/i.test(raw))
    return { message: 'Couldn’t reach the site. Check your internet connection.', suggestUpdate: false }
  if (/nsig|signature|player|403|Forbidden|extract|JavaScript|js-runtime/i.test(raw))
    return { message: 'The site changed how it works. Updating the downloader usually fixes this.', suggestUpdate: true }
  return { message: raw || 'The download stopped unexpectedly.', suggestUpdate: true }
}

export function updateArgs(): string[] {
  return ['-U']
}

/** Whether the output format is something Sparky can convert a finished download into. */
export function isDownloadTarget(ext: string): boolean {
  const cat = formatInfo(ext)?.category
  return cat === 'video' || cat === 'audio'
}
