// FFmpeg argument builders for convert, GIF, thumbnails and compress. Pure: argv out, no file access.
import type { CompressOptions, ConvertOptions, GifOptions, ThumbsOptions } from './options'

export const MEDIA_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv'] as const
export const MEDIA_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] as const
export const MEDIA_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff'] as const
export const MEDIA_GIF_FORMATS = ['gif', 'apng'] as const

export const MEDIA_FORMATS = [...MEDIA_VIDEO_FORMATS, ...MEDIA_AUDIO_FORMATS, ...MEDIA_IMAGE_FORMATS, ...MEDIA_GIF_FORMATS] as const

export type MediaFormat = (typeof MEDIA_FORMATS)[number]
export type MediaKind = 'video' | 'audio' | 'image' | 'gif'

const MEDIA_SET = new Set<string>(MEDIA_FORMATS)

export function isMediaFormat(value: string): value is MediaFormat {
  return MEDIA_SET.has(value)
}

export function mediaKindOf(format: MediaFormat): MediaKind {
  if ((MEDIA_VIDEO_FORMATS as readonly string[]).includes(format)) return 'video'
  if ((MEDIA_AUDIO_FORMATS as readonly string[]).includes(format)) return 'audio'
  if ((MEDIA_GIF_FORMATS as readonly string[]).includes(format)) return 'gif'
  return 'image'
}

const VIDEO_CODEC: Partial<Record<MediaFormat, string[]>> = {
  mp4: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
  mov: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'],
  webm: ['-c:v', 'libvpx-vp9', '-row-mt', '1'],
  mkv: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'],
  avi: ['-c:v', 'mpeg4'],
}

const AUDIO_CODEC: Partial<Record<MediaFormat, string[]>> = {
  mp3: ['-c:a', 'libmp3lame'],
  wav: ['-c:a', 'pcm_s16le'],
  ogg: ['-c:a', 'libvorbis'],
  m4a: ['-c:a', 'aac'],
  aac: ['-c:a', 'aac'],
  flac: ['-c:a', 'flac'],
}

/** Bitrate that lands a target size: bytes*8/seconds, minus audio, with 6% held back for the container. */
export function bitrateForTarget(targetBytes: number, durationSec: number, audioBitrate: number): number | null {
  if (durationSec <= 0) return null
  const total = (targetBytes * 8) / durationSec
  const video = Math.floor((total - audioBitrate) * 0.94)
  return video > 10_000 ? video : null
}

function videoFilters(o: ConvertOptions): string[] {
  const filters: string[] = []
  if (o.crop) filters.push(`crop=${o.crop.width}:${o.crop.height}:${o.crop.x}:${o.crop.y}`)
  if (o.width || o.height) filters.push(`scale=${o.width ?? -2}:${o.height ?? -2}`)
  if (o.flip === 'h' || o.flip === 'hv') filters.push('hflip')
  if (o.flip === 'v' || o.flip === 'hv') filters.push('vflip')
  if (o.rotate === 90) filters.push('transpose=1')
  if (o.rotate === 180) filters.push('transpose=1,transpose=1')
  if (o.rotate === 270) filters.push('transpose=2')
  if (o.fps) filters.push(`fps=${o.fps}`)
  return filters
}

// Before -i, so ffmpeg seeks instead of decoding and discarding. An end of Infinity runs to the end of the file.
function trimArgs(o: { trim?: ConvertOptions['trim'] }): string[] {
  if (!o.trim) return []
  const { start, end } = o.trim
  return [...(start > 0 ? ['-ss', String(start)] : []), ...(Number.isFinite(end) ? ['-t', String(end - start)] : [])]
}

export function convertArgs(
  input: string,
  output: string,
  to: MediaFormat,
  o: ConvertOptions,
  _inputFormat: MediaFormat,
  durationSec = 0,
): string[] {
  // A size target and a format change can arrive together; the solved bitrate wins over crf.
  if (o.targetBytes && durationSec > 0 && mediaKindOf(to) !== 'audio') {
    const bitrate = bitrateForTarget(o.targetBytes, durationSec, o.audioBitrate ?? 128_000)
    if (bitrate) {
      o = { ...o, videoBitrate: bitrate }
      delete o.crf
    }
  }

  const args = ['-hide_banner', '-nostdin', '-y', ...trimArgs(o), '-i', input]

  if (mediaKindOf(to) === 'audio') {
    args.push('-vn', ...(AUDIO_CODEC[to] ?? []))
    if (o.audioBitrate) args.push('-b:a', String(o.audioBitrate))
  } else {
    args.push(...(VIDEO_CODEC[to] ?? []))
    const filters = videoFilters(o)
    if (filters.length) args.push('-vf', filters.join(','))
    if (o.crf !== undefined) args.push('-crf', String(o.crf))
    if (o.videoBitrate) args.push('-b:v', String(o.videoBitrate))
    // libvpx-vp9 treats crf as a cap on a default bitrate unless -b:v is 0.
    else if (to === 'webm' && o.crf !== undefined) args.push('-b:v', '0')
    if (o.preset) args.push('-preset', o.preset)
    if (o.stripAudio) args.push('-an')
    else {
      args.push('-c:a', to === 'webm' ? 'libopus' : 'aac')
      if (o.audioBitrate) args.push('-b:a', String(o.audioBitrate))
    }
  }

  args.push('-progress', 'pipe:1', '-nostats', output)
  return args
}

/** Two-pass palette GIF: a single pass quantises per frame and bands badly. */
export function gifArgs(
  input: string,
  paletteOut: string,
  o: GifOptions,
): { palette: string[]; render: (palette: string, output: string) => string[] } {
  const base = ['-hide_banner', '-nostdin', '-y', ...trimArgs(o), '-i', input]
  const chain = `fps=${o.fps},scale=${o.width}:-1:flags=lanczos`

  return {
    palette: [...base, '-vf', `${chain},palettegen=stats_mode=diff`, '-progress', 'pipe:1', '-nostats', paletteOut],
    render: (palette, output) => [
      ...base,
      '-i',
      palette,
      '-lavfi',
      `${chain}[x];[x][1:v]paletteuse=dither=${o.dither}`,
      '-loop',
      o.loop ? '0' : '-1',
      '-progress',
      'pipe:1',
      '-nostats',
      output,
    ],
  }
}

/** A poster frame, a sprite sheet of evenly spaced frames, or an animated WebP preview. */
export function thumbsArgs(input: string, output: string, o: ThumbsOptions, durationSec = 0): string[] {
  const base = ['-hide_banner', '-nostdin', '-y']
  const scale = `scale=${o.width}:-2:flags=lanczos`

  if (o.mode === 'poster') {
    return [...base, '-ss', String(o.at ?? 0), '-i', input, '-frames:v', '1', '-vf', scale, output]
  }

  if (o.mode === 'sprite') {
    const count = o.count ?? 25
    const columns = o.columns ?? 5
    const rows = Math.ceil(count / columns)
    // Zero duration means the probe failed; one frame a second still gives a usable sheet.
    const fps = durationSec > 0 ? count / durationSec : 1
    return [
      ...base,
      '-i',
      input,
      '-vf',
      `fps=${fps.toFixed(6)},${scale},tile=${columns}x${rows}`,
      '-frames:v',
      '1',
      '-progress',
      'pipe:1',
      '-nostats',
      output,
    ]
  }

  return [
    ...base,
    ...(o.at !== undefined ? ['-ss', String(o.at)] : []),
    '-i',
    input,
    ...(o.durationSec !== undefined ? ['-t', String(o.durationSec)] : []),
    '-vf',
    `fps=${o.fps ?? 10},${scale}`,
    '-loop',
    '0',
    '-progress',
    'pipe:1',
    '-nostats',
    output,
  ]
}

export function compressArgs(
  input: string,
  output: string,
  to: MediaFormat,
  o: CompressOptions,
  inputFormat: MediaFormat,
  durationSec: number,
): string[] {
  const audioBitrate = o.audioBitrate ?? 128_000
  const resolved: ConvertOptions = { ...o, audioBitrate }

  if (o.target) {
    const bitrate = bitrateForTarget(o.target, durationSec, audioBitrate)
    if (bitrate) {
      resolved.videoBitrate = bitrate
      delete resolved.crf
    }
  } else if (resolved.crf === undefined) {
    resolved.crf = o.quality === 'archive' ? 18 : o.quality === 'web' ? 26 : 23
  }

  return convertArgs(input, output, to, resolved, inputFormat)
}
