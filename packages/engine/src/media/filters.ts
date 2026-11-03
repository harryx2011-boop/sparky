// Pure FFmpeg argv builders for the media ops: the edit filter graph, trims, and the encoder section borrowed from convert's plan.
import { PRESET_TARGETS } from '@sparky/core'

export interface EditSpec {
  trimStart?: number
  trimEnd?: number
  cropX?: number
  cropY?: number
  cropWidth?: number
  cropHeight?: number
  rotate?: 90 | 180 | 270
  flip?: 'h' | 'v' | 'hv'
  width?: number
  height?: number
  fps?: number
  stripAudio?: boolean
  volume?: number
  fadeIn?: number
  fadeOut?: number
  reverse?: boolean
  speed?: number
}

const HEAD = ['-hide_banner', '-nostdin', '-y']
const PROGRESS = ['-progress', 'pipe:1', '-nostats']

const num = (n: number) => String(Number(n.toFixed(3)))

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)

export function hasCrop(e: EditSpec): boolean {
  return e.cropX !== undefined || e.cropY !== undefined || e.cropWidth !== undefined || e.cropHeight !== undefined
}

export function hasVideoEdits(e: EditSpec): boolean {
  return hasCrop(e) || e.rotate !== undefined || e.flip !== undefined || e.width !== undefined || e.height !== undefined || e.fps !== undefined
}

export function editedLength(e: EditSpec, sourceDuration?: number): number | undefined {
  const end = e.trimEnd ?? sourceDuration
  if (end === undefined) return undefined
  return Math.max(0, end - (e.trimStart ?? 0)) / (e.speed ?? 1)
}

export function trimInput(e: Pick<EditSpec, 'trimStart' | 'trimEnd'>): string[] {
  const start = e.trimStart ?? 0
  const args = start > 0 ? ['-ss', num(start)] : []
  if (e.trimEnd !== undefined) args.push('-t', num(e.trimEnd - start))
  return args
}

export function atempoChain(speed: number): string[] {
  const steps: string[] = []
  let s = speed
  while (s > 2) {
    steps.push('atempo=2')
    s /= 2
  }
  while (s < 0.5) {
    steps.push('atempo=0.5')
    s /= 0.5
  }
  if (Math.abs(s - 1) > 1e-9) steps.push(`atempo=${num(s)}`)
  return steps
}

function cropFilter(e: EditSpec): string {
  const w = e.cropWidth !== undefined ? String(even(e.cropWidth)) : e.cropX ? `iw-${num(e.cropX)}` : 'iw'
  const h = e.cropHeight !== undefined ? String(even(e.cropHeight)) : e.cropY ? `ih-${num(e.cropY)}` : 'ih'
  if (e.cropX === undefined && e.cropY === undefined) return `crop=${w}:${h}`
  return `crop=${w}:${h}:${e.cropX !== undefined ? num(e.cropX) : '(iw-ow)/2'}:${e.cropY !== undefined ? num(e.cropY) : '(ih-oh)/2'}`
}

export function videoFilters(e: EditSpec, length?: number): string[] {
  const f: string[] = []
  if (hasCrop(e)) f.push(cropFilter(e))
  if (e.flip === 'h' || e.flip === 'hv') f.push('hflip')
  if (e.flip === 'v' || e.flip === 'hv') f.push('vflip')
  if (e.rotate === 90) f.push('transpose=1')
  if (e.rotate === 180) f.push('hflip', 'vflip')
  if (e.rotate === 270) f.push('transpose=2')
  if (e.width !== undefined || e.height !== undefined) {
    f.push(`scale=${e.width !== undefined ? even(e.width) : -2}:${e.height !== undefined ? even(e.height) : -2}`)
  }
  if (e.fps !== undefined) f.push(`fps=${num(e.fps)}`)
  if (e.reverse) f.push('reverse')
  if (e.speed !== undefined && e.speed !== 1) f.push(`setpts=PTS/${num(e.speed)}`)
  if (e.fadeIn) f.push(`fade=t=in:st=0:d=${num(e.fadeIn)}`)
  if (e.fadeOut && length !== undefined) f.push(`fade=t=out:st=${num(Math.max(0, length - e.fadeOut))}:d=${num(e.fadeOut)}`)
  return f
}

export function audioFilters(e: EditSpec, length?: number): string[] {
  const f: string[] = []
  if (e.volume !== undefined && e.volume !== 100) f.push(`volume=${num(e.volume / 100)}`)
  if (e.reverse) f.push('areverse')
  if (e.speed !== undefined) f.push(...atempoChain(e.speed))
  if (e.fadeIn) f.push(`afade=t=in:st=0:d=${num(e.fadeIn)}`)
  if (e.fadeOut && length !== undefined) f.push(`afade=t=out:st=${num(Math.max(0, length - e.fadeOut))}:d=${num(e.fadeOut)}`)
  return f
}

export function encoderSection(planArgs: readonly string[], input: string): string[] {
  const at = planArgs.findIndex((a, i) => a === input && planArgs[i - 1] === '-i')
  const end = planArgs.indexOf('-progress')
  if (at < 0 || end < at) throw new Error('Unexpected FFmpeg plan layout')
  const out: string[] = []
  for (let i = at + 1; i < end; i++) {
    const a = planArgs[i]!
    if (a === '-t' || a === '-vf') i++
    else out.push(a)
  }
  return out
}

function dropOptions(enc: readonly string[], names: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (let i = 0; i < enc.length; i++) {
    if (names.has(enc[i]!)) i++
    else out.push(enc[i]!)
  }
  return out
}

const AUDIO_OPTS = new Set(['-c:a', '-b:a', '-compression_level'])
const CONTAINER_OPTS = new Set(['-movflags'])

export const withoutAudio = (enc: readonly string[]) => dropOptions(enc, AUDIO_OPTS)

export interface EditArgsInput {
  input: string
  output: string
  edit: EditSpec
  encode: string[]
  video: boolean
  audio: boolean
  length?: number
}

export function editArgs(p: EditArgsInput): string[] {
  const vf = p.video ? videoFilters(p.edit, p.length) : []
  const af = p.audio ? audioFilters(p.edit, p.length) : []
  return [
    ...HEAD,
    ...trimInput(p.edit),
    '-i',
    p.input,
    ...(p.audio ? p.encode : withoutAudio(p.encode)),
    ...(vf.length ? ['-vf', vf.join(',')] : []),
    ...(af.length ? ['-af', af.join(',')] : []),
    ...(p.audio ? [] : ['-an']),
    ...PROGRESS,
    p.output,
  ]
}

export type CompressTarget = keyof typeof PRESET_TARGETS

export function targetBytes(target: CompressTarget | undefined, targetMb: number | undefined): number | null {
  if (targetMb !== undefined) return Math.floor(targetMb * 1024 * 1024)
  return PRESET_TARGETS[target ?? 'web']
}

export function audioBpsFor(bytes: number, seconds: number): number {
  const total = (bytes * 8) / seconds
  return total >= 1_000_000 ? 128_000 : total >= 400_000 ? 96_000 : 64_000
}

export function audioOnlyBps(bytes: number, seconds: number): number | null {
  const bps = Math.floor(((bytes * 8) / seconds) * 0.94)
  return bps >= 8_000 ? bps : null
}

export const TWO_PASS_ENCODERS = new Set(['libx264', 'libvpx-vp9'])

export const NULL_OUTPUT = process.platform === 'win32' ? 'NUL' : '/dev/null'

export function twoPassArgs(input: string, output: string, encode: string[], logPrefix: string): { first: string[]; second: string[] } {
  const head = [...HEAD, '-i', input]
  const pass = (n: 1 | 2) => ['-pass', String(n), '-passlogfile', logPrefix]
  return {
    first: [...head, ...dropOptions(withoutAudio(encode), CONTAINER_OPTS), ...pass(1), '-an', '-f', 'null', ...PROGRESS, NULL_OUTPUT],
    second: [...head, ...encode, ...pass(2), ...PROGRESS, output],
  }
}

export function cappedRateArgs(input: string, output: string, encode: string[], videoKbps: number): string[] {
  return [...HEAD, '-i', input, ...encode, '-maxrate', `${videoKbps}k`, '-bufsize', `${videoKbps * 2}k`, ...PROGRESS, output]
}

export function plainArgs(input: string, output: string, encode: string[]): string[] {
  return [...HEAD, '-i', input, ...encode, ...PROGRESS, output]
}
