// A stand-in for window.sparky so the UI can run in a normal browser (npm run dev:ui).
// It fakes a small queue and a few history entries; nothing touches real files.
import {
  batchConcurrency,
  categoryOf,
  defaultSettings,
  normalizeExt,
  OP_TEXT,
  opUnavailableError,
  outputsFor,
  unknownOpError,
  type HistoryEntry,
  type Job,
  type LinkInfo,
  type OpStartResult,
  type OpSummary,
  TOOL_LABELS,
  type Settings,
  type SparkyApi,
} from '@sparky/core'

const MB = 1024 * 1024
let settings: Settings = { ...defaultSettings('C:\\Users\\you\\Documents\\Sparky'), performance: 'max', theme: 'dark' }
let jobs: Job[] = []
const history: HistoryEntry[] = [
  { id: 'h1', kind: 'convert', op: 'convert', title: 'trip-recap.mov → MP4', source: 'C:\\Videos\\trip-recap.mov', outputs: ['C:\\Users\\you\\Documents\\Sparky\\Video\\trip-recap.mp4'], status: 'done', sizeBefore: 318 * MB, sizeAfter: 96 * MB, durationMs: 42_000, finishedAt: Date.now() - 3_600_000 },
  { id: 'h2', kind: 'download', op: 'download', title: 'Lo-fi for late nights → MP3', source: 'https://youtube.com/playlist?list=demo', outputs: ['a.mp3', 'b.mp3'], status: 'done', sizeAfter: 64 * MB, durationMs: 95_000, finishedAt: Date.now() - 86_400_000 },
  { id: 'h3', kind: 'convert', op: 'convert', title: 'report.docx → PDF', source: 'C:\\Docs\\report.docx', outputs: ['C:\\Users\\you\\Documents\\Sparky\\Documents\\report.pdf'], status: 'done', sizeBefore: 2.4 * MB, sizeAfter: 0.62 * MB, durationMs: 2_100, finishedAt: Date.now() - 2 * 86_400_000 },
  { id: 'h4', kind: 'download', op: 'download', title: 'https://example.com/private-video', source: 'https://example.com/private-video', outputs: [], status: 'failed', error: 'This video needs you to be signed in, so it can’t be downloaded.', durationMs: 3_000, finishedAt: Date.now() - 3 * 86_400_000 },
]

type Listener<T> = (v: T) => void
const changeListeners = new Set<Listener<Job[]>>()
const finishListeners = new Set<Listener<Job>>()
const emit = () => changeListeners.forEach((l) => l(jobs.map((j) => ({ ...j }))))

function addJob(j: Omit<Job, 'id' | 'status' | 'progress' | 'outputs' | 'createdAt'>): Job {
  const job: Job = { ...j, id: crypto.randomUUID(), status: 'queued', progress: 0, outputs: [], createdAt: Date.now() }
  jobs.push(job)
  emit()
  return job
}

setInterval(() => {
  let running = jobs.filter((j) => j.status === 'running').length
  for (const j of jobs) {
    if (j.status === 'queued' && running < batchConcurrency(settings.performance, 12, settings.batch)) {
      j.status = 'running'
      j.startedAt = Date.now()
      running++
    }
    if (j.status !== 'running') continue
    j.progress = Math.min(1, j.progress + 0.02 + Math.random() * 0.03)
    j.speed = j.kind === 'download' ? `${(4 + Math.random() * 4).toFixed(1)} MB/s` : `${(2 + Math.random() * 2).toFixed(1)}x`
    j.eta = Math.round(((1 - j.progress) / 0.035) * 0.25)
    if (j.kind === 'download') j.stage = { index: j.progress < 0.6 ? 1 : 2, count: 2, label: j.progress < 0.6 ? 'Downloading' : 'Converting' }
    if (j.progress >= 1) {
      j.status = 'done'
      j.finishedAt = Date.now()
      j.speed = undefined
      j.eta = undefined
      j.sizeAfter = j.sizeBefore ? Math.round(j.sizeBefore * 0.32) : 12 * MB
      j.outputs = [`C:\\Users\\you\\Documents\\Sparky\\${j.title.replace(/ → .*/, '')}`]
      finishListeners.forEach((l) => l({ ...j }))
    }
  }
  emit()
}, 250)

const noop = async () => undefined

const FILES = { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
const OUT = { type: 'string', minLength: 1 }
const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'bmp', 'gif', 'tiff']
const VIDEOS = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'wmv', 'flv']
const AUDIO = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'wma']

function mockOp(o: Pick<OpSummary, 'id' | 'label' | 'doneLabel' | 'category' | 'accepts'> & Partial<OpSummary> & { props: Record<string, unknown>; required?: string[] }): OpSummary {
  const { props, required, ...rest } = o
  return {
    kind: 'tool',
    arity: 'each',
    positional: ['files'],
    requires: [],
    available: true,
    missing: [],
    ...rest,
    inputSchema: { type: 'object', properties: { ...props, out: OUT }, required: required ?? ['files'] },
  }
}

const mockOps: OpSummary[] = [
  mockOp({ id: 'convert', label: OP_TEXT.convert.label, doneLabel: OP_TEXT.convert.done, category: 'convert', kind: 'convert', accepts: [...VIDEOS, ...AUDIO, ...IMAGES, 'pdf', 'docx', 'md'], props: { files: FILES, output: { type: 'string' } }, required: ['files', 'output'] }),
  mockOp({ id: 'download', label: OP_TEXT.download.label, doneLabel: OP_TEXT.download.done, category: 'download', kind: 'download', accepts: [], positional: ['urls'], props: { urls: FILES }, required: ['urls'] }),
  mockOp({
    id: 'pdf.merge',
    label: 'Combine PDFs',
    doneLabel: 'Combined',
    category: 'pdf',
    arity: 'all',
    accepts: ['pdf'],
    props: { files: { ...FILES, minItems: 2 }, bookmarks: { type: 'boolean', default: true, description: 'One per file' } },
  }),
  mockOp({
    id: 'pdf.split',
    label: 'Split a PDF',
    doneLabel: 'Split',
    category: 'pdf',
    accepts: ['pdf'],
    props: {
      files: FILES,
      mode: { type: 'string', enum: ['ranges', 'every', 'odd-even'], default: 'ranges', labels: { ranges: 'Page ranges', every: 'Every few pages', 'odd-even': 'Odd and even' } },
      ranges: { type: 'string', description: 'e.g. 1-3, 5' },
      every: { type: 'integer', minimum: 1, maximum: 500, default: 1 },
    },
  }),
  mockOp({
    id: 'pdf.protect',
    label: 'Add a password to a PDF',
    doneLabel: 'Protected',
    category: 'pdf',
    accepts: ['pdf'],
    secret: ['password'],
    props: { files: FILES, password: { type: 'string', minLength: 1 }, allowPrint: { type: 'boolean', default: true } },
    required: ['files', 'password'],
  }),
  mockOp({
    id: 'pdf.office',
    label: 'Office files to PDF',
    doneLabel: 'Made PDF',
    category: 'pdf',
    accepts: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'rtf'],
    requires: ['libreoffice'],
    available: false,
    missing: ['libreoffice'],
    props: { files: FILES },
  }),
  mockOp({
    id: 'media.trim',
    label: 'Trim a video',
    doneLabel: 'Trimmed',
    category: 'video',
    accepts: VIDEOS,
    props: { files: FILES, start: { type: 'number', minimum: 0, description: 'seconds' }, end: { type: 'number', minimum: 0, description: 'seconds' }, fade: { type: 'boolean' } },
  }),
  mockOp({
    id: 'media.target',
    label: 'Make a video fit a size',
    doneLabel: 'Shrunk',
    category: 'video',
    accepts: VIDEOS,
    props: { files: FILES, preset: { type: 'string', enum: ['email', 'discord', 'custom'], default: 'email' }, targetMb: { type: 'number', exclusiveMinimum: 0 } },
  }),
  mockOp({
    id: 'media.volume',
    label: 'Change the volume',
    doneLabel: 'Changed',
    category: 'audio',
    accepts: [...AUDIO, ...VIDEOS],
    props: { files: FILES, gain: { type: 'number', minimum: -30, maximum: 30, default: 0, description: 'decibels' }, normalize: { type: 'boolean', default: false } },
  }),
  mockOp({
    id: 'image.resize',
    label: 'Resize images',
    doneLabel: 'Resized',
    category: 'image',
    accepts: IMAGES,
    props: {
      files: FILES,
      width: { type: 'integer', exclusiveMinimum: 0 },
      height: { type: 'integer', exclusiveMinimum: 0 },
      percent: { type: 'number', minimum: 1, maximum: 1000 },
      fit: { type: 'string', enum: ['contain', 'cover', 'fill', 'inside', 'outside'] },
      stripMetadata: { type: 'boolean', default: false },
    },
  }),
  mockOp({
    id: 'image.gif',
    label: 'Images to GIF',
    doneLabel: 'Made GIF',
    category: 'image',
    arity: 'all',
    accepts: IMAGES,
    props: { files: FILES, fps: { type: 'integer', minimum: 1, maximum: 60, default: 10 }, loop: { type: 'boolean', default: true } },
  }),
  mockOp({
    id: 'ocr',
    label: 'Read text from images',
    doneLabel: 'Read',
    category: 'tool',
    accepts: [...IMAGES, 'pdf'],
    props: { files: FILES, output: { type: 'string', enum: ['txt', 'pdf'], default: 'txt' }, languages: { type: 'array', items: { type: 'string', minLength: 1 }, default: ['eng'] } },
  }),
]

/** Spreadsheets only print through LibreOffice, which the mock PC doesn't have. */
const NEEDS_OFFICE = new Set(['xls', 'xlsx', 'csv', 'ods'])

export const mockApi: SparkyApi = {
  system: {
    info: async () => ({
      appVersion: '1.0.0 (preview)',
      platform: 'win32',
      cores: 12,
      gpu: { encoders: ['h264_nvenc', 'hevc_nvenc', 'av1_nvenc'] },
      gpuLabel: 'NVIDIA graphics card',
      tools: [
        { id: 'ffmpeg', label: TOOL_LABELS.ffmpeg, found: true, version: '7.1', optional: false },
        { id: 'ffprobe', label: TOOL_LABELS.ffprobe, found: true, version: '7.1', optional: false },
        { id: 'yt-dlp', label: TOOL_LABELS['yt-dlp'], found: true, version: '2026.08.19', optional: false },
        { id: 'pandoc', label: TOOL_LABELS.pandoc, found: true, version: '3.9', optional: false },
        { id: '7zip', label: TOOL_LABELS['7zip'], found: true, version: '25.01', optional: false },
        { id: 'deno', label: TOOL_LABELS.deno, found: true, version: '2.5.1', optional: true },
        { id: 'ghostscript', label: TOOL_LABELS.ghostscript, found: false, optional: true },
        { id: 'libreoffice', label: TOOL_LABELS.libreoffice, found: false, optional: true },
      ],
    }),
  },
  files: {
    pick: async () => ['C:\\Videos\\trip-recap.mov', 'C:\\Audio\\interview.wav', 'C:\\Notes\\notes.md', 'C:\\Sheets\\budget.xlsx'],
    pickFolder: async () => 'D:\\Sparky output',
    probe: async (paths) =>
      paths.map((p) => {
        const ext = normalizeExt(p)
        const category = categoryOf(p)
        const size = ext === 'mov' ? 318 * MB : ext === 'wav' ? 86 * MB : ext === 'md' ? 8 * 1024 : 4 * MB
        return { path: p, name: p.split(/[\\/]/).pop()!, ext, size, category, height: category === 'video' ? 2160 : undefined, width: category === 'video' ? 3840 : undefined, duration: category === 'video' ? 184 : category === 'audio' ? 1260 : undefined }
      }),
    pathFor: (file) => `C:\\Dropped\\${file.name}`,
    showInFolder: noop,
    open: noop,
  },
  convert: {
    start: async (paths, s) => paths.map((p) => addJob({ kind: 'convert', op: 'convert', restartsOnResume: true, title: `${p.split(/[\\/]/).pop()} → ${s.output.toUpperCase()}`, source: p, convert: s, sizeBefore: 80 * MB })),
  },
  download: {
    inspect: async (url): Promise<LinkInfo> => {
      await new Promise((r) => setTimeout(r, 700))
      if (/list=/.test(url))
        return {
          url,
          kind: 'playlist',
          title: 'Lo-fi for late nights',
          uploader: 'Quiet Hours',
          duration: 2890,
          entries: ['Rainy window, warm tea', 'Night bus home', 'Paper lanterns', 'Slow Sunday', 'Streetlight hum', 'Last train'].map((title, i) => ({ index: i + 1, id: String(i), title, duration: 180 + i * 23 })),
          subtitleLangs: [],
        }
      return { url, kind: 'single', title: 'A walk through Kyoto in the rain', uploader: 'Slow Travel', duration: 734, maxHeight: 2160, sizeEstimate: 1.4 * 1024 * MB, entries: [], subtitleLangs: ['en', 'ja'] }
    },
    start: async (req) => addJob({ kind: 'download', op: 'download', title: `${req.title ?? req.url}${req.convertTo ? ` → ${req.convertTo.toUpperCase()}` : ''}`, source: req.url, download: req }),
  },
  ops: {
    list: async () => mockOps,
    targets: async (paths) =>
      paths.map((p) => {
        const ext = normalizeExt(p)
        return {
          path: p,
          targets: outputsFor(p).map((f) => {
            const gone = f.ext === 'pdf' && NEEDS_OFFICE.has(ext) ? ['libreoffice'] : []
            return { op: 'convert', ext: f.ext, available: gone.length === 0, missing: gone }
          }),
        }
      }),
    start: async (id, raw): Promise<OpStartResult> => {
      const op = mockOps.find((o) => o.id === id)
      if (!op) return { ok: false, error: { code: 'unknown_op', message: unknownOpError(id), field: 'op' } }
      if (!op.available) return { ok: false, error: { code: 'unavailable', message: opUnavailableError(op.label, op.missing) } }
      const args = (raw ?? {}) as Record<string, unknown>
      const files = Array.isArray(args.files) ? (args.files as string[]) : []
      if (op.id === 'pdf.merge' && files.length < 2) return { ok: false, error: { code: 'invalid_input', message: 'Add at least two PDFs to combine.', field: 'files' } }
      const items = op.arity === 'each' ? files.map((f) => [f]) : [files]
      const created = items.map((group) => addJob({ kind: 'tool', op: op.id, restartsOnResume: true, title: `${op.label}: ${group.map((f) => f.split(/[\\/]/).pop()).join(', ')}`, source: group[0] ?? '', sizeBefore: 12 * MB }))
      return { ok: true, jobs: created }
    },
  },
  queue: {
    list: async () => jobs,
    pause: async (id) => void jobs.forEach((j) => j.id === id && (j.status = 'paused')),
    resume: async (id) => void jobs.forEach((j) => j.id === id && (j.status = 'queued')),
    cancel: async (id) => void jobs.forEach((j) => j.id === id && (j.status = 'canceled')),
    retry: async (id) => void jobs.forEach((j) => j.id === id && Object.assign(j, { status: 'queued', progress: 0, error: undefined })),
    remove: async (id) => void (jobs = jobs.filter((j) => j.id !== id)),
    reorder: async (ids) => void (jobs = [...jobs].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))),
    pauseAll: async () => void jobs.forEach((j) => (j.status === 'running' || j.status === 'queued') && (j.status = 'paused')),
    resumeAll: async () => void jobs.forEach((j) => j.status === 'paused' && (j.status = 'queued')),
    clearFinished: async () => void (jobs = jobs.filter((j) => ['queued', 'running', 'paused'].includes(j.status))),
    onChange: (l) => (changeListeners.add(l), () => changeListeners.delete(l)),
    onFinished: (l) => (finishListeners.add(l), () => finishListeners.delete(l)),
  },
  history: {
    search: async (q) =>
      history.filter(
        (h) =>
          (!q.text || h.title.toLowerCase().includes(q.text.toLowerCase())) &&
          (!q.kind || q.kind === 'all' || h.kind === q.kind) &&
          (!q.status || q.status === 'all' || h.status === q.status),
      ),
    rerun: async () => ({ ok: true, jobs: [] }),
    remove: async (id) => void history.splice(history.findIndex((h) => h.id === id), 1),
    clear: async () => void history.splice(0),
  },
  settings: {
    get: async () => settings,
    set: async (patch) => (settings = { ...settings, ...patch }),
  },
  tools: { updateYtDlp: async () => ({ ok: true, message: 'The downloader is already up to date.' }) },
  clipboard: {
    onOffer: (l) => {
      const t = setTimeout(() => l({ url: 'https://youtu.be/night-bus-home' }), 1500)
      return () => clearTimeout(t)
    },
    dismiss: noop,
  },
  window: { minimize: () => undefined, toggleMaximize: () => undefined, close: () => undefined, onMaximizedChange: () => () => undefined, isMaximized: async () => false },
  openExternal: async (url) => void window.open(url, '_blank'),
  copyText: async (t) => navigator.clipboard?.writeText(t),
  onNavigate: () => () => undefined,
  api: { info: async () => ({ running: true, port: 8600, tokenPath: 'C:\\Users\\you\\AppData\\Roaming\\Sparky\\api-token' }), revealToken: noop },
  icons: { forExt: async () => null },
  agents: {
    detect: async () => [
      { id: 'claude-code', label: 'Claude Code', found: true, installed: false, current: false, configPath: 'C:\\Users\\you\\.claude.json' },
      { id: 'cursor', label: 'Cursor', found: true, installed: true, current: true, configPath: 'C:\\Users\\you\\.cursor\\mcp.json' },
      { id: 'codex', label: 'Codex', found: false, installed: false, current: false, configPath: 'C:\\Users\\you\\.codex\\config.toml' },
      { id: 'windsurf', label: 'Windsurf', found: false, installed: false, current: false, configPath: 'C:\\Users\\you\\.codeium\\windsurf\\mcp_config.json' },
    ],
    install: async () => ({ ok: true, message: 'Added Sparky to Claude Code.' }),
  },
}
