// Job, settings and IPC types shared by the app's main process and its UI.
import type { FolderListing, FolderListResult, Places } from './folders'
import { normalizeExt, type Category } from './formats'
import type { GpuInfo, VideoCodec } from './gpu'
import type { CompressionLevel, PerformanceLevel, Resolution } from './levels'

export type OriginalsMode = 'keep' | 'replace' | 'trash'

export interface AdvancedOptions {
  codec?: VideoCodec
  videoKbps?: number
  audioKbps?: number
  imageQuality?: number
  trimStart?: number
  trimEnd?: number
  width?: number
  height?: number
  fps?: number
}

export interface ConvertSettings {
  output: string
  compression: CompressionLevel
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
  title?: string
  mode: 'video' | 'audio'
  quality: Resolution | null
  items?: number[]
  count?: number
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

export type JobKind = 'convert' | 'download' | 'tool'

export interface Job {
  id: string
  kind: JobKind
  op: string
  args?: unknown
  restartsOnResume?: boolean
  title: string
  source: string
  category?: Category | 'download'
  status: JobStatus
  stage?: JobStage
  progress: number
  speed?: string
  eta?: number
  outputs: string[]
  sizeBefore?: number
  sizeAfter?: number
  error?: string
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

export const OP_TEXT = {
  convert: { label: 'Convert a file', done: 'Converted' },
  download: { label: 'Download from a link', done: 'Downloaded' },
  unknown: { label: 'A task', done: 'Finished' },
} as const

export function convertTitle(input: string, output: string): string {
  const name = input.split(/[\\/]/).pop() ?? input
  const ext = normalizeExt(output)
  return `${name} → ${ext === 'folder' ? 'Folder' : ext.toUpperCase()}`
}

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

export const OPTIONAL_TOOLS: ReadonlySet<ToolStatus['id']> = new Set(['deno', 'ghostscript', 'libreoffice'])

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
  duration?: number
  width?: number
  height?: number
}

export interface LinkEntry {
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
  maxHeight?: number
  sizeEstimate?: number
  entries: LinkEntry[]
  subtitleLangs: string[]
  extractor?: string
}

export interface ClipboardOffer {
  url: string
}

export interface OpSummary {
  id: string
  label: string
  doneLabel: string
  category: string
  kind: JobKind
  arity: 'each' | 'all'
  positional: string[]
  requires: string[]
  secret?: string[]
  accepts: string[]
  inputSchema: Record<string, unknown>
  available: boolean
  missing: string[]
}

export interface TargetSummary {
  op: string
  ext: string
  available: boolean
  missing: string[]
}

export type OpStartResult = { ok: true; jobs: Job[] } | { ok: false; error: { code: string; message: string; field?: string } }

export interface SaveResult {
  canceled: boolean
  saved: number
  missing: number
  dest?: string
}

export interface SparkyApi {
  system: {
    info(): Promise<SystemInfo>
  }
  files: {
    pick(): Promise<string[]>
    pickFolder(): Promise<string | null>
    probe(paths: string[]): Promise<ProbeResult[]>
    pathFor(file: File): string
    showInFolder(path: string): Promise<void>
    open(path: string): Promise<void>
    save(paths: string[]): Promise<SaveResult>
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
    revealToken(): Promise<void>
  }
  icons: {
    forExt(ext: string): Promise<string | null>
  }
  folders: {
    list(path: string): Promise<FolderListResult>
    rest(id: string): Promise<FolderListing | null>
    watch(path: string): Promise<string>
    unwatch(id: string): Promise<void>
    onChange(listener: (watchId: string) => void): () => void
    places(): Promise<Places>
  }
  agents: {
    detect(): Promise<AgentClient[]>
    install(id: string): Promise<AgentInstallResult>
  }
}

export type Section = 'browse' | 'convert' | 'download' | 'tools' | 'queue' | 'history' | 'settings'

export interface ApiInfo {
  running: boolean
  port: number
  tokenPath: string
}

export interface AgentClient {
  id: string
  label: string
  found: boolean
  installed: boolean
  current: boolean
  configPath: string
}

export interface AgentInstallResult {
  ok: boolean
  message: string
  path?: string
}
