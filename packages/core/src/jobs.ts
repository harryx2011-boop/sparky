// Job, settings and IPC types shared by the app's main process and its UI.
import { normalizeExt, type Category } from './formats'
import type { GpuInfo, VideoCodec } from './gpu'
import type { CompressionLevel, PerformanceLevel, Resolution } from './levels'

export type OriginalsMode = 'keep' | 'replace' | 'trash'

export interface AdvancedOptions {
  codec?: VideoCodec
  /** Overrides the compression level's video quality with a fixed bitrate. */
  videoKbps?: number
  audioKbps?: number
  /** 1–100, images only. Overrides the compression level. */
  imageQuality?: number
  /** Seconds. */
  trimStart?: number
  trimEnd?: number
  /** Resize images (or GIFs). Keeps the aspect ratio when only one is set. */
  width?: number
  height?: number
  /** Frames per second for GIF output. */
  fps?: number
}

export interface ConvertSettings {
  /** Output extension, e.g. "mp4". Same as the input means "just shrink it". */
  output: string
  compression: CompressionLevel
  /** null keeps the source resolution. */
  resolution: Resolution | null
  performance: PerformanceLevel
  originals: OriginalsMode
  advanced: AdvancedOptions
}

export type SubtitleMode = 'off' | 'download' | 'embed'

export interface DownloadExtras {
  thumbnail: boolean
  subtitles: SubtitleMode
  subtitleLangs: string[]
  metadata: boolean
  sponsorBlock: boolean
}

export interface DownloadRequest {
  url: string
  /** Title shown in the queue. */
  title?: string
  mode: 'video' | 'audio'
  /** null means "best available". */
  quality: Resolution | null
  /** 1-based playlist positions. Empty or undefined downloads everything. */
  items?: number[]
  /** How many items this request will download, for overall progress. */
  count?: number
  /** Convert the finished download into this format in the same job. */
  convertTo?: string | null
  compression: CompressionLevel
  performance: PerformanceLevel
  extras: DownloadExtras
}

export type JobStatus = 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'canceled'

export interface JobStage {
  index: number
  count: number
  label: string
}

/** The app's bucket for a job: its icon, its History filter. Which op ran it is `Job.op`. */
export type JobKind = 'convert' | 'download' | 'tool'

export interface Job {
  id: string
  kind: JobKind
  /** The engine op that runs this job, e.g. "convert" or "pdf.merge". */
  op: string
  /** The op's input as validated by its schema, including the caller's `out`. */
  args?: unknown
  /** Pausing throws the work away, so a resumed job starts from the beginning. */
  restartsOnResume?: boolean
  title: string
  /** File path or link. */
  source: string
  category?: Category | 'download'
  status: JobStatus
  stage?: JobStage
  /** 0–1, or -1 when progress can't be measured. */
  progress: number
  /** e.g. "3.1x" or "6.4 MB/s" */
  speed?: string
  /** Seconds left. */
  eta?: number
  outputs: string[]
  sizeBefore?: number
  sizeAfter?: number
  error?: string
  /** A hint that yt-dlp may need an update. */
  suggestUpdate?: boolean
  note?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  convert?: ConvertSettings
  download?: DownloadRequest
}

export interface HistoryEntry {
  id: string
  kind: Job['kind']
  op: string
  args?: unknown
  title: string
  source: string
  outputs: string[]
  status: Extract<JobStatus, 'done' | 'failed' | 'canceled'>
  error?: string
  sizeBefore?: number
  sizeAfter?: number
  durationMs: number
  finishedAt: number
  convert?: ConvertSettings
  download?: DownloadRequest
}

/** Plain-language words for the engine's ops: `label` for the app and the CLI help, `done` for the finished notification. One row per op. */
export const OP_TEXT = {
  convert: { label: 'Convert a file', done: 'Converted' },
  download: { label: 'Download from a link', done: 'Downloaded' },
  /** A job whose op this build doesn't know, such as one queued by a newer CLI. */
  unknown: { label: 'A task', done: 'Finished' },
} as const

/** Queue title for a conversion, e.g. "clip.mov → MP4". */
export function convertTitle(input: string, output: string): string {
  const name = input.split(/[\\/]/).pop() ?? input
  const ext = normalizeExt(output)
  return `${name} → ${ext === 'folder' ? 'Folder' : ext.toUpperCase()}`
}

/** Queue title for a download, e.g. "Night bus home → MP3". */
export function downloadTitle(req: Pick<DownloadRequest, 'url' | 'title' | 'mode' | 'convertTo'>): string {
  const target = req.convertTo ? ` → ${req.convertTo.toUpperCase()}` : req.mode === 'audio' ? ' → MP3' : ''
  return `${req.title ?? req.url}${target}`
}

export interface HistoryQuery {
  text?: string
  kind?: Job['kind'] | 'all'
  status?: HistoryEntry['status'] | 'all'
  limit?: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  outputRoot: string
  /** Work on several files at the same time. How many is Sparky's call, from the Performance level and the PC. */
  batch: boolean
  performance: PerformanceLevel
  compression: CompressionLevel
  codec: VideoCodec
  theme: Theme
  closeToTray: boolean
  notifications: boolean
  openFolderOnDownload: boolean
  clipboardDetection: boolean
  sidebarCollapsed: boolean
  dockHeight: number
  downloadExtras: DownloadExtras
  downloadMode: 'video' | 'audio'
}

export const DEFAULT_DOWNLOAD_EXTRAS: DownloadExtras = {
  thumbnail: true,
  subtitles: 'off',
  subtitleLangs: ['en'],
  metadata: true,
  sponsorBlock: false,
}

export function defaultSettings(outputRoot: string): Settings {
  return {
    outputRoot,
    batch: true,
    performance: 'normal',
    compression: 2,
    codec: 'h264',
    theme: 'dark',
    closeToTray: true,
    notifications: true,
    openFolderOnDownload: true,
    clipboardDetection: true,
    sidebarCollapsed: false,
    dockHeight: 168,
    downloadExtras: DEFAULT_DOWNLOAD_EXTRAS,
    downloadMode: 'video',
  }
}

/** Hard limits for the queue itself; the batch rule stays well inside them. */
export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 8

export interface ToolStatus {
  id: 'ffmpeg' | 'ffprobe' | 'yt-dlp' | 'pandoc' | '7zip' | 'deno' | 'ghostscript' | 'libreoffice'
  label: string
  found: boolean
  version?: string
  path?: string
  optional: boolean
}

/** What each bundled tool does, in plain words, shown in Settings. One place, so the app and its browser preview agree. */
export const TOOL_LABELS: Record<ToolStatus['id'], string> = {
  ffmpeg: 'Video, audio and images',
  ffprobe: 'Reads file details',
  'yt-dlp': 'Downloads from links',
  pandoc: 'Documents',
  '7zip': 'Archives',
  deno: 'Helps with YouTube',
  ghostscript: 'Shrinks PDFs',
  libreoffice: 'Better Word to PDF',
}

/** Tools the user installs; the rest ship inside Sparky. */
export const OPTIONAL_TOOLS: ReadonlySet<ToolStatus['id']> = new Set(['deno', 'ghostscript', 'libreoffice'])

/** The tools' own names, for the credits line and the add-on hints where a person has to find them by name. */
export const TOOL_NAMES: Record<ToolStatus['id'], string> = {
  ffmpeg: 'FFmpeg',
  ffprobe: 'FFprobe',
  'yt-dlp': 'yt-dlp',
  pandoc: 'Pandoc',
  '7zip': '7-Zip',
  deno: 'Deno',
  ghostscript: 'Ghostscript',
  libreoffice: 'LibreOffice',
}

export interface SystemInfo {
  appVersion: string
  platform: string
  cores: number
  gpu: GpuInfo
  gpuLabel: string
  tools: ToolStatus[]
}

export interface ProbeResult {
  path: string
  name: string
  ext: string
  size: number
  category?: Category
  /** Seconds, for audio and video. */
  duration?: number
  width?: number
  height?: number
}

export interface LinkEntry {
  /** 1-based position in the playlist. */
  index: number
  id: string
  title: string
  duration?: number
  url?: string
}

export interface LinkInfo {
  url: string
  kind: 'single' | 'playlist'
  title: string
  uploader?: string
  thumbnail?: string
  duration?: number
  /** Tallest video height on offer. */
  maxHeight?: number
  /** Rough size of the best download, in bytes. */
  sizeEstimate?: number
  entries: LinkEntry[]
  subtitleLangs: string[]
  extractor?: string
}

export interface ClipboardOffer {
  url: string
}

/** An engine op as the app sees it. `missing` holds tool ids ("libreoffice") and app capabilities ("print", "trash"). */
export interface OpSummary {
  id: string
  label: string
  doneLabel: string
  /** 'pdf', 'video', 'audio', 'image', 'document', 'archive', 'tool', or 'convert'/'download' for the two ops with their own pages. */
  category: string
  kind: JobKind
  arity: 'each' | 'all'
  positional: string[]
  requires: string[]
  /** Fields to render as password inputs; Sparky never stores them. */
  secret?: string[]
  /** Extensions the op takes, lower case, without the dot. */
  accepts: string[]
  /** JSON Schema of the op's input, `out` included. */
  inputSchema: Record<string, unknown>
  available: boolean
  missing: string[]
}

/** One thing a file can become, and whether this PC can make it. */
export interface TargetSummary {
  op: string
  ext: string
  available: boolean
  missing: string[]
}

export type OpStartResult = { ok: true; jobs: Job[] } | { ok: false; error: { code: string; message: string; field?: string } }

/** The API the preload script exposes as `window.sparky`. */
export interface SparkyApi {
  system: {
    info(): Promise<SystemInfo>
  }
  files: {
    pick(): Promise<string[]>
    pickFolder(): Promise<string | null>
    probe(paths: string[]): Promise<ProbeResult[]>
    /** Path for a File dropped into the window. */
    pathFor(file: File): string
    showInFolder(path: string): Promise<void>
    open(path: string): Promise<void>
  }
  convert: {
    start(paths: string[], settings: ConvertSettings): Promise<Job[]>
  }
  download: {
    inspect(url: string): Promise<LinkInfo>
    start(request: DownloadRequest): Promise<Job>
  }
  ops: {
    list(): Promise<OpSummary[]>
    targets(paths: string[]): Promise<{ path: string; targets: TargetSummary[] }[]>
    /** Never throws for bad input: a wrong or unavailable request comes back as `ok: false`. */
    start(op: string, args: unknown): Promise<OpStartResult>
  }
  queue: {
    list(): Promise<Job[]>
    pause(id: string): Promise<void>
    resume(id: string): Promise<void>
    cancel(id: string): Promise<void>
    retry(id: string): Promise<void>
    remove(id: string): Promise<void>
    reorder(ids: string[]): Promise<void>
    pauseAll(): Promise<void>
    resumeAll(): Promise<void>
    clearFinished(): Promise<void>
    onChange(listener: (jobs: Job[]) => void): () => void
    onFinished(listener: (job: Job) => void): () => void
  }
  history: {
    search(query: HistoryQuery): Promise<HistoryEntry[]>
    /** A refused rerun (bad input, or a password Sparky never kept) comes back as `ok: false`. */
    rerun(id: string): Promise<OpStartResult>
    remove(id: string): Promise<void>
    clear(): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  tools: {
    updateYtDlp(): Promise<{ ok: boolean; message: string }>
  }
  clipboard: {
    onOffer(listener: (offer: ClipboardOffer) => void): () => void
    dismiss(url: string): Promise<void>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    onMaximizedChange(listener: (maximized: boolean) => void): () => void
    isMaximized(): Promise<boolean>
  }
  openExternal(url: string): Promise<void>
  copyText(text: string): Promise<void>
  onNavigate(listener: (to: { section: Section; url?: string }) => void): () => void
  api: {
    info(): Promise<ApiInfo>
    /** Shows the token file in Explorer; the token itself never reaches the UI or the clipboard. */
    revealToken(): Promise<void>
  }
  icons: {
    /** A data URL for the icon Windows shows for this extension, or null when Windows has no specific one. */
    forExt(ext: string): Promise<string | null>
  }
  agents: {
    detect(): Promise<AgentClient[]>
    install(id: string): Promise<AgentInstallResult>
  }
}

export type Section = 'convert' | 'download' | 'tools' | 'queue' | 'history' | 'settings'

/** The local HTTP API as the app hosts it, for the Settings Agents group. */
export interface ApiInfo {
  /** False when the port was taken at startup. */
  running: boolean
  port: number
  /** The token file clients read. */
  tokenPath: string
}

/** An agent client that can run Sparky's MCP server. */
export interface AgentClient {
  id: string
  label: string
  /** The client is installed on this PC. */
  found: boolean
  /** Its config already lists Sparky. */
  installed: boolean
  /** Installed, and it starts this copy of Sparky the way Sparky would write it now. False means an update is offered. */
  current: boolean
  configPath: string
}

export interface AgentInstallResult {
  ok: boolean
  message: string
  path?: string
}
