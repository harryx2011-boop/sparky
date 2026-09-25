// Performance, compression and resolution levels.
// Labels and descriptions here are shown to people, so they stay in plain words.

export type PerformanceLevel = 'low' | 'normal' | 'max'

export interface PerformanceInfo {
  id: PerformanceLevel
  label: string
  /** How many of the five bars light up. */
  bars: 1 | 3 | 5
  /** One sentence on what the level means for the person, in plain words. */
  description: string
  /** A few words for captions: what happens to the PC while it works. */
  outcome: string
}

export const PERFORMANCE_LEVELS: readonly PerformanceInfo[] = [
  { id: 'low', label: 'Low', bars: 1, description: 'Quiet. Your PC stays cool and free for other things, and jobs take longer.', outcome: 'Slow and quiet' },
  { id: 'normal', label: 'Normal', bars: 3, description: 'Steady. Good speed without getting in the way of what you’re doing.', outcome: 'Steady, PC stays usable' },
  { id: 'max', label: 'Max', bars: 5, description: 'Fastest. Sparky takes everything your PC can give, so other apps may feel slow until it’s done.', outcome: 'Fastest, PC gets busy' },
]

export function performanceInfo(level: PerformanceLevel): PerformanceInfo {
  return PERFORMANCE_LEVELS.find((l) => l.id === level) ?? PERFORMANCE_LEVELS[1]!
}

export interface PerformanceProfile {
  /** Thread count passed to encoders; 0 means "let the tool decide". */
  threads: number
  /** Use a hardware (graphics card) encoder when one is available. */
  useGpu: boolean
  /** Lower the process priority so the PC stays responsive. */
  lowPriority: boolean
}

export function performanceProfile(level: PerformanceLevel, cores: number): PerformanceProfile {
  switch (level) {
    case 'low':
      return { threads: 1, useGpu: false, lowPriority: true }
    case 'normal':
      return { threads: Math.max(1, Math.min(cores - 1, Math.ceil(cores / 2))), useGpu: false, lowPriority: false }
    case 'max':
      return { threads: 0, useGpu: true, lowPriority: false }
  }
}

/** Most jobs Sparky runs side by side, whatever the PC. */
export const BATCH_MAX = 4

/**
 * How many jobs run at the same time. Off means one at a time.
 * Low keeps the PC quiet, so one. Normal already gives each job half the processor, so two fill it.
 * Max takes everything, so about half the processor's threads, between two and four: extra jobs mostly
 * help when the graphics card does the heavy part or when downloads and documents sit beside a video.
 */
export function batchConcurrency(level: PerformanceLevel, cores: number, batch: boolean): number {
  if (!batch || level === 'low') return 1
  if (level === 'normal') return 2
  const half = Math.round((Number.isFinite(cores) ? cores : 0) / 2)
  return Math.max(2, Math.min(BATCH_MAX, half))
}

export type CompressionLevel = 0 | 1 | 2 | 3 | 4

export const DEFAULT_COMPRESSION: CompressionLevel = 2

export interface CompressionInfo {
  level: CompressionLevel
  label: string
  /** Friendly hint shown under the slider. */
  hint: string
  /** x264/x265-style quality number (lower is better). */
  crf: number
  audioKbps: number
  /** 1–100 quality for lossy images. */
  imageQuality: number
  /** 7-Zip -mx level for archives. */
  archiveLevel: 0 | 1 | 3 | 5 | 7 | 9
  /** Ghostscript -dPDFSETTINGS preset, when PDFs can be shrunk. */
  pdfPreset: '/prepress' | '/printer' | '/ebook' | '/screen'
  /** Caps the video to this fraction of its source size (Tiny only). */
  scaleCap?: number
}

export const COMPRESSION_LEVELS: readonly CompressionInfo[] = [
  { level: 0, label: 'Lossless', hint: 'Original quality export', crf: 16, audioKbps: 320, imageQuality: 95, archiveLevel: 1, pdfPreset: '/prepress' },
  { level: 1, label: 'High', hint: 'Hard to tell apart, a bit smaller', crf: 20, audioKbps: 256, imageQuality: 88, archiveLevel: 3, pdfPreset: '/printer' },
  { level: 2, label: 'Balanced', hint: 'Good quality at a sensible size', crf: 23, audioKbps: 192, imageQuality: 80, archiveLevel: 5, pdfPreset: '/ebook' },
  { level: 3, label: 'Small', hint: 'Easy to share, some detail lost', crf: 28, audioKbps: 128, imageQuality: 70, archiveLevel: 7, pdfPreset: '/ebook' },
  { level: 4, label: 'Tiny', hint: 'As small as it gets, half size video', crf: 32, audioKbps: 96, imageQuality: 55, archiveLevel: 9, pdfPreset: '/screen', scaleCap: 0.5 },
]

/** Archives are always lossless, so the slider reads as speed vs. size instead. */
export const ARCHIVE_COMPRESSION_LABELS = ['Fastest', 'Fast', 'Normal', 'Smaller', 'Smallest'] as const

export function compressionInfo(level: number): CompressionInfo {
  const clamped = Math.max(0, Math.min(4, Math.round(level))) as CompressionLevel
  return COMPRESSION_LEVELS[clamped]!
}

export type Resolution = 720 | 1080 | 1440 | 2160

export const RESOLUTIONS: readonly Resolution[] = [720, 1080, 1440, 2160]

export function resolutionLabel(r: Resolution): string {
  return r === 2160 ? '4K' : `${r}p`
}

/** Resolutions that need Max performance and a graphics card encoder. */
export function isHighResolution(r: Resolution): boolean {
  return r >= 1440
}
