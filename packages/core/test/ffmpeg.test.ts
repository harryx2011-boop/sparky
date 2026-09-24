import { describe, expect, it } from 'vitest'
import { buildFfmpegPlan, createFfmpegProgressParser, jpegQscale, parseFfprobe, summarizeFfmpegError, type ConvertSettings } from '../src'

const base: ConvertSettings = { output: 'mp4', compression: 2, resolution: null, performance: 'normal', originals: 'keep', advanced: {} }
const plan = (s: Partial<ConvertSettings>, extra: { gpu?: string[]; sourceHeight?: number; output?: string } = {}) =>
  buildFfmpegPlan({
    input: 'in.mov',
    output: extra.output ?? `out.${s.output ?? 'mp4'}`,
    settings: { ...base, ...s },
    defaultCodec: 'h264',
    gpu: { encoders: extra.gpu ?? [] },
    cores: 8,
    sourceHeight: extra.sourceHeight,
  })
const arg = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

describe('buildFfmpegPlan', () => {
  it('uses x264 with the Balanced quality on Normal', () => {
    const p = plan({})
    expect(arg(p.args, '-c:v')).toBe('libx264')
    expect(arg(p.args, '-crf')).toBe('23')
    expect(arg(p.args, '-threads')).toBe('4')
    expect(p.args).toContain('+faststart')
    expect(p.args.at(-1)).toBe('out.mp4')
    expect(p.usedGpu).toBe(false)
  })

  it('uses one thread and low priority on Low', () => {
    const p = plan({ performance: 'low' })
    expect(arg(p.args, '-threads')).toBe('1')
    expect(p.lowPriority).toBe(true)
  })

  it('uses the graphics card on Max when there is one', () => {
    const p = plan({ performance: 'max', compression: 0 }, { gpu: ['h264_nvenc'] })
    expect(arg(p.args, '-c:v')).toBe('h264_nvenc')
    expect(arg(p.args, '-cq')).toBe('16')
    expect(p.args).not.toContain('-threads')
    expect(p.usedGpu).toBe(true)
  })

  it('falls back to every CPU core on Max without a GPU, and says so', () => {
    const p = plan({ performance: 'max' })
    expect(arg(p.args, '-c:v')).toBe('libx264')
    expect(p.notes[0]).toMatch(/processor/)
  })

  it('builds AMD and Intel quality flags', () => {
    expect(arg(plan({ performance: 'max' }, { gpu: ['h264_amf'] }).args, '-qp_i')).toBe('23')
    expect(arg(plan({ performance: 'max' }, { gpu: ['h264_qsv'] }).args, '-global_quality')).toBe('23')
  })

  it('scales down but never up', () => {
    expect(arg(plan({ resolution: 720 }, { sourceHeight: 2160 }).args, '-vf')).toBe("scale=-2:'trunc(min(720,ih)/2)*2'")
    expect(plan({ resolution: 1080 }, { sourceHeight: 720 }).args).not.toContain('-vf')
    expect(arg(plan({ compression: 4 }).args, '-vf')).toBe("scale=-2:'trunc(ih*0.5/2)*2'")
    expect(arg(plan({ compression: 4, resolution: 1080 }).args, '-vf')).toBe("scale=-2:'trunc(min(1080,ih*0.5)/2)*2'")
  })

  it('trims before and after the input', () => {
    const p = plan({ advanced: { trimStart: 10, trimEnd: 25 } })
    expect(p.args.indexOf('-ss')).toBeLessThan(p.args.indexOf('-i'))
    expect(arg(p.args, '-t')).toBe('15')
  })

  it('uses VP9 and Opus for WEBM', () => {
    const p = plan({ output: 'webm' })
    expect(arg(p.args, '-c:v')).toBe('libvpx-vp9')
    expect(arg(p.args, '-c:a')).toBe('libopus')
  })

  it('tags HEVC in MP4 so it plays on Apple devices', () => {
    const p = plan({ advanced: { codec: 'hevc' } })
    expect(arg(p.args, '-c:v')).toBe('libx265')
    expect(arg(p.args, '-tag:v')).toBe('hvc1')
  })

  it('extracts sound from video', () => {
    const p = plan({ output: 'mp3', compression: 3 })
    expect(p.args).toContain('-vn')
    expect(arg(p.args, '-b:a')).toBe('128k')
    expect(p.encoder).toBeUndefined()
  })

  it('makes GIFs with a palette', () => {
    const p = plan({ output: 'gif' })
    expect(arg(p.args, '-vf')).toMatch(/palettegen/)
    expect(arg(p.args, '-loop')).toBe('0')
  })

  it('converts images with a quality number', () => {
    const p = buildFfmpegPlan({ input: 'a.heic', output: 'a.jpg', settings: { ...base, output: 'jpg' }, defaultCodec: 'h264', gpu: { encoders: [] }, cores: 4 })
    expect(arg(p.args, '-q:v')).toBe(String(jpegQscale(80)))
    expect(arg(p.args, '-frames:v')).toBe('1')
  })

  it('respects a fixed bitrate from Advanced', () => {
    const p = plan({ advanced: { videoKbps: 2500 } })
    expect(arg(p.args, '-b:v')).toBe('2500k')
    expect(p.args).not.toContain('-crf')
  })
})

describe('progress', () => {
  it('reports progress, speed and time left', () => {
    const parse = createFfmpegProgressParser(100)
    expect(parse('frame=10\nout_time_us=25000000\nspeed=2.5x\n')).toBeUndefined()
    const u = parse('progress=continue\n')
    expect(u).toEqual({ progress: 0.25, speed: '2.5x', eta: 30, done: false })
    expect(parse('out_time_us=100000000\nspeed=2.5x\nprogress=end\n')).toMatchObject({ progress: 1, done: true })
  })

  it('copes with chunks split mid-line and unknown length', () => {
    const parse = createFfmpegProgressParser()
    parse('out_time_us=5000')
    expect(parse('000\nprogress=continue\n')).toMatchObject({ progress: -1 })
  })

  it('reads ffprobe json', () => {
    const info = parseFfprobe(JSON.stringify({ format: { duration: '12.5' }, streams: [{ codec_type: 'video', width: 3840, height: 2160 }, { codec_type: 'audio' }] }))
    expect(info).toEqual({ duration: 12.5, width: 3840, height: 2160, hasAudio: true, hasVideo: true })
  })

  it('ignores cover art when looking for video', () => {
    const info = parseFfprobe(JSON.stringify({ format: { duration: '3' }, streams: [{ codec_type: 'audio' }, { codec_type: 'video', width: 500, height: 500, disposition: { attached_pic: 1 } }] }))
    expect(info.hasVideo).toBe(false)
  })

  it('finds the useful error line', () => {
    expect(summarizeFfmpegError('Input #0\nfoo.mp4: No such file or directory\n')).toBe('foo.mp4: No such file or directory')
  })
})
