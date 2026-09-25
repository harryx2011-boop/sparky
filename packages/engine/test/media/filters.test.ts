// The media ops' argv builders, without running anything.
import { buildFfmpegPlan, gifArgs, thumbsArgs, type ConvertSettings } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { inputSchema, RESERVED_INPUTS } from '../../src'
import {
  atempoChain,
  audioBpsFor,
  audioFilters,
  cappedRateArgs,
  editArgs,
  editedLength,
  encoderSection,
  targetBytes,
  trimInput,
  twoPassArgs,
  videoFilters,
  withoutAudio,
} from '../../src/media/filters'
import { gifOptions } from '../../src/media/gif'
import { thumbsOptions } from '../../src/media/thumbs'
import { mediaOps } from '../../src/ops/media'

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

function plan(ext: string, o: { performance?: ConvertSettings['performance']; compression?: ConvertSettings['compression']; gpu?: string[]; videoKbps?: number } = {}) {
  return buildFfmpegPlan({
    input: 'C:/in/clip.mov',
    output: `C:/out/x.${ext}`,
    settings: { output: ext, compression: o.compression ?? 2, resolution: null, performance: o.performance ?? 'normal', originals: 'keep', advanced: { videoKbps: o.videoKbps } },
    defaultCodec: 'h264',
    gpu: { encoders: o.gpu ?? [] },
    cores: 8,
  }).args
}

describe('media op registry entries', () => {
  it('registers the four ops as flat, reserved-name-free tool ops with a JSON schema', () => {
    expect(mediaOps.map((o) => o.id)).toEqual(['media.edit', 'media.compress', 'media.thumbs', 'media.gif'])
    for (const op of mediaOps) {
      expect(op).toMatchObject({ kind: 'tool', arity: 'each', positional: ['files'], paths: ['files'] })
      const js = inputSchema(op)
      expect(js.type).toBe('object')
      expect(JSON.stringify(js)).not.toContain(String(Number.MAX_SAFE_INTEGER))
      for (const name of RESERVED_INPUTS) expect(Object.keys(op.input.shape), `${op.id}.${name}`).not.toContain(name)
    }
  })

  it('labels every field in plain words for the Tools page', () => {
    for (const op of mediaOps) {
      const props = inputSchema(op).properties as Record<string, { title?: string; description?: string }>
      for (const [name, p] of Object.entries(props)) {
        if (name === 'out') continue
        expect(p.title, `${op.id}.${name}`).toBeTruthy()
        expect(p.description, `${op.id}.${name}`).toBeTruthy()
        expect(`${p.title} ${p.description}`, `${op.id}.${name}`).not.toMatch(/codec|bitrate|crf|encoder|ffmpeg/i)
      }
    }
  })

  it('declares boolean defaults so a form that never sends false still gets the right behaviour', () => {
    const gif = mediaOps.find((o) => o.id === 'media.gif')!
    expect(gif.input.parse({ files: ['a.mp4'] })).toMatchObject({ loop: true })
    expect((inputSchema(gif).properties as Record<string, { default?: unknown }>).loop!.default).toBe(true)
    for (const op of mediaOps) {
      const props = inputSchema(op).properties as Record<string, { type?: string; default?: unknown }>
      for (const [name, p] of Object.entries(props)) if (p.type === 'boolean') expect(typeof p.default, `${op.id}.${name}`).toBe('boolean')
    }
  })

  it('words every choice of every pick-one field', () => {
    for (const op of mediaOps) {
      const props = inputSchema(op).properties as Record<string, { enum?: unknown[]; anyOf?: { const?: unknown }[]; labels?: Record<string, string> }>
      for (const [name, p] of Object.entries(props)) {
        const values = p.enum ?? p.anyOf?.map((o) => o.const)
        if (!values) continue
        expect(Object.keys(p.labels ?? {}).sort(), `${op.id}.${name}`).toEqual(values.map(String).sort())
      }
    }
  })

  it('names no other service’s size in its words', () => {
    expect(JSON.stringify(inputSchema(mediaOps.find((o) => o.id === 'media.compress')!))).not.toMatch(/\d+ ?MB/)
  })

  it('takes video (and sound, where it makes sense)', () => {
    const [edit, compress, thumbs, gif] = mediaOps
    expect(edit!.accepts('wav') && edit!.accepts('mov') && compress!.accepts('mp3')).toBe(true)
    expect(thumbs!.accepts('mp3') || gif!.accepts('wav') || edit!.accepts('png')).toBe(false)
  })
})

describe('edit filters', () => {
  it('crops, flips, turns, sizes, then handles timing, in that order', () => {
    const f = videoFilters({ cropX: 10, cropY: 20, cropWidth: 640, cropHeight: 360, flip: 'h', rotate: 90, width: 320, fps: 24, reverse: true, speed: 2, fadeIn: 1 })
    expect(f).toEqual(['crop=640:360:10:20', 'hflip', 'transpose=1', 'scale=320:-2', 'fps=24', 'reverse', 'setpts=PTS/2', 'fade=t=in:st=0:d=1'])
  })

  it('centres a crop with no position and keeps sizes even', () => {
    expect(videoFilters({ cropWidth: 641, cropHeight: 361 })).toEqual(['crop=640:360'])
    expect(videoFilters({ cropX: 100 })).toEqual(['crop=iw-100:ih:100:(ih-oh)/2'])
  })

  it('turns half way with two flips and a quarter back with transpose=2', () => {
    expect(videoFilters({ rotate: 180 })).toEqual(['hflip', 'vflip'])
    expect(videoFilters({ rotate: 270, flip: 'hv' })).toEqual(['hflip', 'vflip', 'transpose=2'])
  })

  it('keeps the shape when one side is given', () => {
    expect(videoFilters({ width: 641 })).toEqual(['scale=640:-2'])
    expect(videoFilters({ height: 480 })).toEqual(['scale=-2:480'])
    expect(videoFilters({ width: 300, height: 200 })).toEqual(['scale=300:200'])
  })

  it('fades out from the end of the edited length', () => {
    expect(videoFilters({ fadeOut: 2 }, 10)).toEqual(['fade=t=out:st=8:d=2'])
    expect(audioFilters({ fadeOut: 2 }, 10)).toEqual(['afade=t=out:st=8:d=2'])
    expect(videoFilters({ fadeOut: 2 })).toEqual([])
  })

  it('sets the sound level as a fraction and leaves 100% alone', () => {
    expect(audioFilters({ volume: 150 })).toEqual(['volume=1.5'])
    expect(audioFilters({ volume: 100 })).toEqual([])
    expect(audioFilters({ volume: 0 })).toEqual(['volume=0'])
    expect(audioFilters({ reverse: true, fadeIn: 0.5 })).toEqual(['areverse', 'afade=t=in:st=0:d=0.5'])
  })

  it('chains atempo so every step stays between half and double', () => {
    expect(atempoChain(1)).toEqual([])
    expect(atempoChain(4)).toEqual(['atempo=2', 'atempo=2'])
    expect(atempoChain(3)).toEqual(['atempo=2', 'atempo=1.5'])
    expect(atempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5'])
    expect(atempoChain(0.8)).toEqual(['atempo=0.8'])
  })

  it('works out the length after trim and speed', () => {
    expect(editedLength({ trimStart: 2, trimEnd: 8, speed: 2 }, 20)).toBe(3)
    expect(editedLength({ trimStart: 5 }, 20)).toBe(15)
    expect(editedLength({})).toBeUndefined()
  })

  it('trims as input options so speed and reverse only see the kept stretch', () => {
    expect(trimInput({ trimStart: 1.5, trimEnd: 4 })).toEqual(['-ss', '1.5', '-t', '2.5'])
    expect(trimInput({ trimEnd: 4 })).toEqual(['-t', '4'])
    const args = editArgs({ input: 'in.mov', output: 'out.mp4', edit: { trimStart: 1, trimEnd: 3, speed: 0.5 }, encode: ['-c:v', 'libx264', '-c:a', 'aac'], video: true, audio: true, length: 4 })
    expect(args.indexOf('-t')).toBeLessThan(args.indexOf('-i'))
    expect(after(args, '-vf')).toBe('setpts=PTS/0.5')
    expect(after(args, '-af')).toBe('atempo=0.5')
    expect(args.at(-1)).toBe('out.mp4')
    expect(after(args, '-progress')).toBe('pipe:1')
  })

  it('drops the sound settings and adds -an when the sound goes', () => {
    const args = editArgs({ input: 'in.mov', output: 'out.mp4', edit: { stripAudio: true, volume: 50 }, encode: ['-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k'], video: true, audio: false })
    expect(args).toContain('-an')
    expect(args).not.toContain('-c:a')
    expect(args).not.toContain('-af')
  })

  it('leaves the picture filters out of a sound-only result', () => {
    const args = editArgs({ input: 'in.mov', output: 'out.mp3', edit: { rotate: 90, volume: 50 }, encode: ['-vn', '-c:a', 'libmp3lame'], video: false, audio: true })
    expect(args).not.toContain('-vf')
    expect(after(args, '-af')).toBe('volume=0.5')
  })
})

describe('encoder section from convert’s plan', () => {
  it('keeps codec, quality, threads, sound and container flags, and nothing about the input or output', () => {
    const enc = encoderSection(plan('mp4'), 'C:/in/clip.mov')
    expect(after(enc, '-c:v')).toBe('libx264')
    expect(enc).toContain('-threads')
    expect(after(enc, '-c:a')).toBe('aac')
    expect(enc).toContain('-movflags')
    expect(enc).not.toContain('-i')
    expect(enc).not.toContain('-progress')
    expect(enc).not.toContain('C:/out/x.mp4')
  })

  it('drops the plan’s own resize, which the edit sets itself', () => {
    expect(plan('mp4', { compression: 4 })).toContain('-vf')
    expect(encoderSection(plan('mp4', { compression: 4 }), 'C:/in/clip.mov')).not.toContain('-vf')
  })

  it('uses the graphics card only on Max, as convert does', () => {
    expect(after(encoderSection(plan('mp4', { performance: 'max', gpu: ['h264_nvenc'] }), 'C:/in/clip.mov'), '-c:v')).toBe('h264_nvenc')
    expect(after(encoderSection(plan('mp4', { performance: 'normal', gpu: ['h264_nvenc'] }), 'C:/in/clip.mov'), '-c:v')).toBe('libx264')
  })

  it('gives a sound target the sound settings only', () => {
    const enc = encoderSection(plan('mp3'), 'C:/in/clip.mov')
    expect(enc).toContain('-vn')
    expect(after(enc, '-c:a')).toBe('libmp3lame')
    expect(withoutAudio(enc)).not.toContain('-c:a')
  })
})

describe('compress', () => {
  it('aims for the preset size, or the MB given, or a quality', () => {
    expect(targetBytes('discord', undefined)).toBe(10 * 1024 * 1024)
    expect(targetBytes('email', undefined)).toBe(25 * 1024 * 1024)
    expect(targetBytes('email', 8)).toBe(8 * 1024 * 1024)
    expect(targetBytes('web', undefined)).toBeNull()
    expect(targetBytes(undefined, undefined)).toBeNull()
  })

  it('gives sound less of a small budget', () => {
    expect(audioBpsFor(10 * 1024 * 1024, 60)).toBe(128_000)
    expect(audioBpsFor(3 * 1024 * 1024, 60)).toBe(96_000)
    expect(audioBpsFor(1024 * 1024, 60)).toBe(64_000)
  })

  it('measures in a silent first pass that writes nowhere, then encodes with sound', () => {
    const enc = encoderSection(plan('mp4', { videoKbps: 800 }), 'C:/in/clip.mov')
    const { first, second } = twoPassArgs('C:/in/clip.mov', 'C:/out/x.mp4', enc, 'C:/tmp/pass')
    expect(after(first, '-pass')).toBe('1')
    expect(after(first, '-passlogfile')).toBe('C:/tmp/pass')
    expect(first).toContain('-an')
    expect(first).not.toContain('-c:a')
    expect(first).not.toContain('-movflags')
    expect(after(first, '-f')).toBe('null')
    expect(after(second, '-pass')).toBe('2')
    expect(after(second, '-b:v')).toBe('800k')
    expect(second).toContain('-c:a')
    expect(second.at(-1)).toBe('C:/out/x.mp4')
  })

  it('caps the rate on a single pass', () => {
    const args = cappedRateArgs('i.mov', 'o.mp4', ['-c:v', 'h264_nvenc', '-b:v', '800k'], 800)
    expect(after(args, '-maxrate')).toBe('800k')
    expect(after(args, '-bufsize')).toBe('1600k')
  })
})

describe('thumbnail and GIF defaults', () => {
  it('takes the poster a tenth of the way in, never past the last frame', () => {
    expect(thumbsOptions({}, { duration: 20, width: 1920 })).toEqual({ mode: 'poster', width: 1920, at: 2 })
    expect(thumbsOptions({ at: 99 }, { duration: 3 }).at).toBe(2.5)
    expect(thumbsOptions({}, {}).at).toBe(0)
  })

  it('lays out a sprite five across unless there are fewer frames', () => {
    expect(thumbsOptions({ mode: 'sprite' }, {})).toMatchObject({ count: 25, columns: 5, width: 160 })
    expect(thumbsOptions({ mode: 'sprite', count: 3 }, {})).toMatchObject({ columns: 3 })
    const args = thumbsArgs('in.mp4', 'out.png', thumbsOptions({ mode: 'sprite', count: 6, columns: 3 }, { duration: 3 }), 3)
    expect(after(args, '-vf')).toBe('fps=2.000000,scale=160:-2:flags=lanczos,tile=3x2')
  })

  it('keeps a preview no wider than the video', () => {
    expect(thumbsOptions({ mode: 'preview' }, { duration: 10, width: 320 })).toEqual({ mode: 'preview', width: 320, at: 1, durationSec: 3, fps: 10 })
  })

  it('makes a GIF of an open-ended trim without a length', () => {
    const o = gifOptions({ trimStart: 2 }, 1280)
    expect(o).toMatchObject({ fps: 12, width: 480, loop: true, dither: 'sierra2_4a' })
    const { palette } = gifArgs('in.mp4', 'p.png', o)
    expect(after(palette, '-ss')).toBe('2')
    expect(palette).not.toContain('-t')
    expect(after(palette, '-progress')).toBe('pipe:1')
  })
})
