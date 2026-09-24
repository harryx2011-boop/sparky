// Graphics card encoders and the 1440p/4K unlock rules.
import { isHighResolution, RESOLUTIONS, resolutionLabel, type PerformanceLevel, type Resolution } from './levels'

export type VideoCodec = 'h264' | 'hevc' | 'av1'
export type GpuVendor = 'nvidia' | 'amd' | 'intel'

export const GPU_VENDOR_LABELS: Record<GpuVendor, string> = {
  nvidia: 'NVIDIA',
  amd: 'AMD',
  intel: 'Intel',
}

/** FFmpeg encoder names per vendor and codec. */
export const GPU_ENCODERS: Record<GpuVendor, Record<VideoCodec, string>> = {
  nvidia: { h264: 'h264_nvenc', hevc: 'hevc_nvenc', av1: 'av1_nvenc' },
  amd: { h264: 'h264_amf', hevc: 'hevc_amf', av1: 'av1_amf' },
  intel: { h264: 'h264_qsv', hevc: 'hevc_qsv', av1: 'av1_qsv' },
}

export const CPU_ENCODERS: Record<VideoCodec, string> = {
  h264: 'libx264',
  hevc: 'libx265',
  av1: 'libsvtav1',
}

export const CODEC_LABELS: Record<VideoCodec, string> = {
  h264: 'Standard (H.264) · plays everywhere',
  hevc: 'Newer (HEVC) · smaller files',
  av1: 'Newest (AV1) · smallest files, needs recent devices',
}

/** Hardware encoders that were found and actually worked on this PC. */
export interface GpuInfo {
  /** e.g. ["h264_nvenc", "hevc_nvenc"] */
  encoders: string[]
}

export const NO_GPU: GpuInfo = { encoders: [] }

/** Parses `ffmpeg -hide_banner -encoders` and returns the hardware encoders it was built with. */
export function parseEncoderList(output: string): string[] {
  const known = new Set(Object.values(GPU_ENCODERS).flatMap((c) => Object.values(c)))
  const found: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const m = /^\s*V[.A-Z]{5}\s+(\S+)/.exec(line)
    if (m && known.has(m[1]!)) found.push(m[1]!)
  }
  return found
}

export function gpuEncoderFor(gpu: GpuInfo, codec: VideoCodec): { vendor: GpuVendor; encoder: string } | undefined {
  for (const vendor of ['nvidia', 'amd', 'intel'] as const) {
    const encoder = GPU_ENCODERS[vendor][codec]
    if (gpu.encoders.includes(encoder)) return { vendor, encoder }
  }
  return undefined
}

export function describeGpu(gpu: GpuInfo): string {
  const vendors = (['nvidia', 'amd', 'intel'] as const).filter((v) =>
    Object.values(GPU_ENCODERS[v]).some((e) => gpu.encoders.includes(e)),
  )
  if (vendors.length === 0) return 'No supported graphics card found'
  return `${vendors.map((v) => GPU_VENDOR_LABELS[v]).join(' + ')} graphics card`
}

export interface ResolutionOption {
  value: Resolution
  label: string
  /** Hidden options are above the source size. Sparky never upscales. */
  hidden: boolean
  locked: boolean
  /** Why it is locked, in plain words. Shown as a tooltip. */
  reason?: string
}

export interface ResolutionContext {
  /** Height of the source in pixels, if known. */
  sourceHeight?: number
  performance: PerformanceLevel
  gpu: GpuInfo
  codec: VideoCodec
}

export function resolutionOptions(ctx: ResolutionContext): ResolutionOption[] {
  return RESOLUTIONS.map((value) => {
    const label = resolutionLabel(value)
    const hidden = ctx.sourceHeight !== undefined && ctx.sourceHeight > 0 && ctx.sourceHeight < value
    if (hidden) return { value, label, hidden, locked: true, reason: `The original is smaller than ${label}` }
    if (!isHighResolution(value)) return { value, label, hidden, locked: false }
    if (ctx.performance !== 'max') {
      return { value, label, hidden, locked: true, reason: 'Switch Performance to Max to unlock 1440p and 4K' }
    }
    if (!gpuEncoderFor(ctx.gpu, ctx.codec)) {
      return { value, label, hidden, locked: true, reason: 'Your graphics card can’t help with this video type, so 1440p and 4K stay off. Pick another video type under More options or in Settings.' }
    }
    return { value, label, hidden, locked: false }
  })
}

/** Clamps a wanted resolution to the best one that is actually available. */
export function clampResolution(wanted: Resolution | null, options: ResolutionOption[]): Resolution | null {
  if (wanted === null) return null
  const usable = options.filter((o) => !o.hidden && !o.locked).map((o) => o.value)
  if (usable.includes(wanted)) return wanted
  const lower = usable.filter((v) => v < wanted)
  return lower.length ? lower[lower.length - 1]! : null
}
