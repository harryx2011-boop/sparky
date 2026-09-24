// Builds FFmpeg command lines and reads its progress output.
import { CPU_ENCODERS, gpuEncoderFor, type GpuInfo, type GpuVendor, type VideoCodec } from './gpu'
import { normalizeExt, formatInfo } from './formats'
import { compressionInfo, performanceProfile } from './levels'
import type { ConvertSettings } from './jobs'

export interface FfmpegPlanInput {
  input: string
  output: string
  settings: ConvertSettings
  /** Codec picked in Settings, used unless Advanced overrides it. */
  defaultCodec: VideoCodec
  gpu: GpuInfo
  cores: number
  sourceHeight?: number
}

export interface FfmpegPlan {
  args: string[]
  /** Video encoder in use, if any. */
  encoder?: string
  usedGpu: boolean
  /** Plain-language notes for the job card, e.g. why Max fell back to the CPU. */
  notes: string[]
  lowPriority: boolean
}

/** Per-codec quality numbers for each compression level (lower is better). */
const QUALITY: Record<'h264' | 'hevc' | 'av1' | 'vp9', readonly number[]> = {
  h264: [16, 20, 23, 28, 32],
  hevc: [18, 22, 26, 30, 34],
  av1: [22, 28, 33, 40, 48],
  vp9: [20, 28, 33, 39, 46],
}

const GIF_STEPS = [
  { width: 960, fps: 20, colors: 256 },
  { width: 720, fps: 15, colors: 256 },
  { width: 540, fps: 15, colors: 192 },
  { width: 420, fps: 12, colors: 128 },
  { width: 320, fps: 10, colors: 64 },
] as const

export function jpegQscale(quality: number): number {
  return Math.max(2, Math.min(31, Math.round((100 - quality) / 5) + 1))
}

export function avifCrf(quality: number): number {
  return Math.max(0, Math.min(63, Math.round(63 - quality * 0.6)))
}

function scaleFilter(o: { resolution: number | null; scaleCap?: number; width?: number; height?: number; sourceHeight?: number }): string | undefined {
  if (o.width || o.height) return `scale=${o.width ?? -2}:${o.height ?? -2}`
  if (o.resolution === null && !o.scaleCap) return undefined
  if (!o.scaleCap && o.resolution !== null && o.sourceHeight !== undefined && o.sourceHeight <= o.resolution) return undefined
  // Never taller than the source, and always an even number of pixels.
  let h = o.scaleCap ? `ih*${o.scaleCap}` : 'ih'
  if (o.resolution !== null) h = `min(${o.resolution},${h})`
  return `scale=-2:'trunc(${h}/2)*2'`
}

function gpuQualityArgs(vendor: GpuVendor, encoder: string, q: number): string[] {
  switch (vendor) {
    case 'nvidia':
      return ['-c:v', encoder, '-preset', 'p5', '-rc', 'vbr', '-cq', String(q), '-b:v', '0']
    case 'amd':
      return ['-c:v', encoder, '-quality', 'balanced', '-rc', 'cqp', '-qp_i', String(q), '-qp_p', String(q), ...(encoder.startsWith('h264') ? ['-qp_b', String(q)] : [])]
    case 'intel':
      return ['-c:v', encoder, '-preset', 'medium', '-global_quality', String(q)]
  }
}

function audioArgs(ext: string, kbps: number): string[] {
  switch (ext) {
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`]
    case 'm4a':
    case 'mp4':
    case 'mov':
    case 'mkv':
    case 'avi':
      return ['-c:a', 'aac', '-b:a', `${Math.min(kbps, 320)}k`]
    case 'ogg':
      return ['-c:a', 'libvorbis', '-b:a', `${kbps}k`]
    case 'webm':
      return ['-c:a', 'libopus', '-b:a', `${Math.min(kbps, 256)}k`]
    case 'wav':
      return ['-c:a', 'pcm_s16le']
    case 'flac':
      return ['-c:a', 'flac', '-compression_level', '8']
    default:
      return []
  }
}

export function buildFfmpegPlan(p: FfmpegPlanInput): FfmpegPlan {
  const { settings } = p
  const out = normalizeExt(p.output)
  const outInfo = formatInfo(out)
  const comp = compressionInfo(settings.compression)
  const adv = settings.advanced
  const profile = performanceProfile(settings.performance, p.cores)
  const notes: string[] = []

  const args: string[] = ['-hide_banner', '-nostdin', '-y']
  if (adv.trimStart && adv.trimStart > 0) args.push('-ss', String(adv.trimStart))
  args.push('-i', p.input)
  if (adv.trimEnd && adv.trimEnd > (adv.trimStart ?? 0)) args.push('-t', String(adv.trimEnd - (adv.trimStart ?? 0)))
  if (profile.threads > 0) args.push('-threads', String(profile.threads))

  let encoder: string | undefined
  let usedGpu = false
  const audioKbps = adv.audioKbps ?? comp.audioKbps

  if (outInfo?.category === 'audio') {
    args.push('-vn', '-map_metadata', '0', ...audioArgs(out, audioKbps))
    if (out === 'm4a') args.push('-movflags', '+faststart')
  } else if (out === 'gif') {
    const step = GIF_STEPS[settings.compression]!
    const fps = adv.fps ?? step.fps
    const width = adv.width ?? step.width
    args.push(
      '-vf',
      `fps=${fps},scale='min(${width},iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${step.colors}[p];[b][p]paletteuse=dither=bayer`,
      '-loop',
      '0',
    )
  } else if (outInfo?.category === 'video') {
    let codec: VideoCodec | 'vp9' = adv.codec ?? p.defaultCodec
    if (out === 'webm') codec = codec === 'av1' ? 'av1' : 'vp9'
    if ((out === 'avi' || out === 'mov') && codec === 'av1') codec = 'h264'
    if (out === 'avi') codec = 'h264'
    const q = QUALITY[codec][settings.compression]!

    const gpu = codec !== 'vp9' && profile.useGpu ? gpuEncoderFor(p.gpu, codec) : undefined
    if (gpu) {
      encoder = gpu.encoder
      usedGpu = true
      args.push(...(adv.videoKbps ? ['-c:v', gpu.encoder, '-b:v', `${adv.videoKbps}k`] : gpuQualityArgs(gpu.vendor, gpu.encoder, q)))
    } else {
      if (profile.useGpu && codec !== 'vp9') notes.push('No graphics card can help with this one, so Max is using all of your processor instead.')
      encoder = codec === 'vp9' ? 'libvpx-vp9' : CPU_ENCODERS[codec]
      args.push('-c:v', encoder)
      if (adv.videoKbps) args.push('-b:v', `${adv.videoKbps}k`)
      else if (codec === 'vp9') args.push('-crf', String(q), '-b:v', '0', '-row-mt', '1')
      else if (codec === 'av1') args.push('-crf', String(q), '-preset', settings.performance === 'low' ? '10' : '8')
      else args.push('-crf', String(q), '-preset', settings.performance === 'low' ? 'faster' : 'medium')
    }
    if (codec === 'hevc' && (out === 'mp4' || out === 'mov')) args.push('-tag:v', 'hvc1')
    if (codec === 'h264' || codec === 'hevc') args.push('-pix_fmt', 'yuv420p')

    const scale = scaleFilter({
      resolution: settings.resolution,
      scaleCap: comp.scaleCap,
      width: adv.width,
      height: adv.height,
      sourceHeight: p.sourceHeight,
    })
    if (scale) args.push('-vf', scale)
    args.push(...audioArgs(out, audioKbps))
    if (out === 'mp4' || out === 'mov') args.push('-movflags', '+faststart')
  } else if (outInfo?.category === 'image') {
    const quality = adv.imageQuality ?? comp.imageQuality
    const filters: string[] = []
    if (out === 'ico') filters.push(`scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease`)
    else if (adv.width || adv.height) filters.push(`scale=${adv.width ?? -2}:${adv.height ?? -2}`)
    if (filters.length) args.push('-vf', filters.join(','))
    args.push('-frames:v', '1')
    if (out === 'jpg') args.push('-c:v', 'mjpeg', '-q:v', String(jpegQscale(quality)), '-pix_fmt', 'yuvj420p')
    else if (out === 'webp') args.push('-c:v', 'libwebp', '-quality', String(quality))
    else if (out === 'avif') args.push('-c:v', 'libaom-av1', '-still-picture', '1', '-crf', String(avifCrf(quality)), '-cpu-used', '6')
    else if (out === 'png') args.push('-c:v', 'png', '-compression_level', String(settings.compression >= 3 ? 9 : 6))
  }

  args.push('-progress', 'pipe:1', '-stats_period', '0.25', '-nostats', p.output)
  return { args, encoder, usedGpu, notes, lowPriority: profile.lowPriority }
}

export interface FfprobeInfo {
  duration?: number
  width?: number
  height?: number
  hasAudio: boolean
  hasVideo: boolean
}

export const FFPROBE_ARGS = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams']

/** Reads `ffprobe -print_format json -show_format -show_streams` output. */
export function parseFfprobe(json: string): FfprobeInfo {
  const data = JSON.parse(json) as {
    format?: { duration?: string }
    streams?: { codec_type?: string; width?: number; height?: number; duration?: string; disposition?: { attached_pic?: number } }[]
  }
  const streams = data.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic)
  const duration = Number(data.format?.duration ?? video?.duration)
  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    width: video?.width,
    height: video?.height,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
    hasVideo: Boolean(video),
  }
}

export interface ProgressUpdate {
  /** 0–1, or -1 when the total length is unknown. */
  progress: number
  speed?: string
  eta?: number
  done: boolean
}

/**
 * Parses the key=value stream from `-progress pipe:1`.
 * Feed it raw stdout chunks; it returns an update after each complete block.
 */
export function createFfmpegProgressParser(totalSeconds?: number) {
  let buffer = ''
  let block: Record<string, string> = {}
  return (chunk: string): ProgressUpdate | undefined => {
    buffer += chunk
    let latest: ProgressUpdate | undefined
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq)
      const value = line.slice(eq + 1)
      block[key] = value
      if (key !== 'progress') continue

      const outUs = Number(block.out_time_us ?? block.out_time_ms)
      const outSec = Number.isFinite(outUs) && outUs > 0 ? outUs / 1_000_000 : 0
      const speedNum = Number.parseFloat((block.speed ?? '').replace('x', ''))
      const done = value === 'end'
      let progress = -1
      let eta: number | undefined
      if (totalSeconds && totalSeconds > 0) {
        progress = done ? 1 : Math.max(0, Math.min(0.999, outSec / totalSeconds))
        if (!done && speedNum > 0) eta = Math.max(0, (totalSeconds - outSec) / speedNum)
      } else if (done) {
        progress = 1
      }
      latest = {
        progress,
        speed: Number.isFinite(speedNum) && speedNum > 0 ? `${speedNum >= 10 ? speedNum.toFixed(0) : speedNum.toFixed(1)}x` : undefined,
        eta,
        done,
      }
      block = {}
    }
    return latest
  }
}

/** Test encode used to confirm a hardware encoder really works on this PC. */
export function gpuTestArgs(encoder: string): string[] {
  return ['-hide_banner', '-nostdin', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-frames:v', '1', '-c:v', encoder, '-f', 'null', '-']
}

