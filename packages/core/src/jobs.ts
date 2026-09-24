// Job, settings and IPC types shared by the app's main process and its UI.
import type { Category } from './formats'
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

export interface Job {
  id: string
  kind: 'convert' | 'download'
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

export interface HistoryQuery {
  text?: string
  kind?: Job['kind'] | 'all'
  status?: HistoryEntry['status'] | 'all'
  limit?: number
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  outputRoot: string
  concurrency: number
  performance: PerformanceLevel
  compression: CompressionLevel
  codec: VideoCodec
  theme: Theme
  closeToTray: boolean
  notifications: boolean
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
    concurrency: 2,
    performance: 'normal',
    compression: 2,
    codec: 'h264',
    theme: 'system',
    closeToTray: true,
    notifications: true,
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
    rerun(id: string): Promise<Job[]>
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
  onNavigate(listener: (section: string) => void): () => void
}
