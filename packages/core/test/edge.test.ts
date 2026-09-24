// Edge cases a real user hits: odd links, odd tool output, odd names and the 1440p/4K boundaries.
import { describe, expect, it } from 'vitest'
import {
  asLink,
  buildFfmpegPlan,
  categoryOf,
  createFfmpegProgressParser,
  explainFfmpegError,
  explainFileError,
  explainSevenZipError,
  explainYtDlpError,
  normalizeExt,
  outputName,
  parseFfprobe,
  parseLinkInfo,
  parseYtDlpLine,
  PERFORMANCE_LEVELS,
  resolutionOptions,
  type ConvertSettings,
} from '../src'

const JARGON = /\b(GPU|CPU|encoder|codec|bitrate|transcode|thread|core|ffmpeg|yt-dlp|nvenc|amf|qsv|ENOENT|EACCES|EPERM)\b/i

describe('links people actually paste', () => {
  it('adds https:// when the scheme was left off', () => {
    expect(asLink('www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc')
    expect(asLink('youtu.be/abc')).toBe('https://youtu.be/abc')
    expect(asLink('hello world')).toBeUndefined()
    expect(asLink('notalink')).toBeUndefined()
  })

  it('strips the angle brackets chat apps wrap links in', () => {
    expect(asLink('<https://youtu.be/abc>')).toBe('https://youtu.be/abc')
  })

  it('rejects non-web schemes and empty text', () => {
    expect(asLink('javascript:alert(1)')).toBeUndefined()
    expect(asLink('file:///C:/clip.mp4')).toBeUndefined()
    expect(asLink('')).toBeUndefined()
    expect(asLink('   ')).toBeUndefined()
  })
})

describe('download errors in plain words', () => {
  it('does not mistake "webpage" for an age check', () => {
    const e = explainYtDlpError('ERROR: [generic] abc: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>')
    expect(e.message).toMatch(/reach the site|internet/i)
    expect(e.suggestUpdate).toBe(false)
  })

  it('explains a private video, a bot check and an age gate differently', () => {
    expect(explainYtDlpError("ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video").message).toMatch(/private/i)
    const bot = explainYtDlpError("ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser")
    expect(bot.message).toMatch(/sign-in check|try again/i)
    expect(bot.suggestUpdate).toBe(true)
    expect(explainYtDlpError('ERROR: [youtube] abc: Sign in to confirm your age').message).toMatch(/age/i)
  })

  it('never leaks tool jargon into the message', () => {
    for (const raw of [
      'ERROR: [youtube] abc: nsig extraction failed: Some formats may be missing',
      'ERROR: Unsupported URL: https://example.com/x',
      'ERROR: [youtube] abc: Requested format is not available',
      '',
    ]) {
      expect(explainYtDlpError(raw).message).not.toMatch(JARGON)
    }
  })

  it('reads an empty playlist', () => {
    const info = parseLinkInfo(JSON.stringify({ _type: 'playlist', title: 'Empty', entries: [] }), 'u')
    expect(info.kind).toBe('playlist')
    expect(info.entries).toEqual([])
    expect(info.duration).toBeUndefined()
  })
})

describe('tool errors in plain words', () => {
  it('explains broken and missing media files', () => {
    expect(explainFfmpegError('zero.mp4: Invalid data found when processing input')).toMatch(/damaged|not really/i)
    expect(explainFfmpegError('moov atom not found\nError opening input files: Invalid data found when processing input')).toMatch(/damaged|not really/i)
    expect(explainFfmpegError('clip.mov: No such file or directory')).toMatch(/gone|moved|deleted/i)
    expect(explainFfmpegError('clip.mov: Permission denied')).toMatch(/permission|another app/i)
    expect(explainFfmpegError('')).not.toMatch(JARGON)
  })

  it('explains 7-Zip failures instead of quoting its last line', () => {
    const out = 'ERROR: bad.zip\nOpen ERROR: Cannot open the file as [zip] archive\n\nERRORS:\nIs not archive\nCan\'t open as archive: 1\nFiles: 0\nSize:       0\nCompressed: 0\n'
    expect(explainSevenZipError(out, 'zip')).toMatch(/damaged|not really/i)
    expect(explainSevenZipError('Can not open the file as archive', 'rar')).toMatch(/RAR/)
    expect(explainSevenZipError('ERROR: Wrong password : secret.7z', '7z')).toMatch(/password/i)
    expect(explainSevenZipError('Compressed: 0', 'zip')).not.toBe('Compressed: 0')
  })

  it('explains file system errors with what to do next', () => {
    const missing = explainFileError(Object.assign(new Error('ENOENT: no such file or directory, mkdir \'Z:\\Sparky\\Video\''), { code: 'ENOENT', path: 'Z:\\Sparky\\Video' }), 'save')
    expect(missing).toMatch(/folder/i)
    expect(missing).toMatch(/Settings/)
    expect(missing).not.toMatch(JARGON)
    expect(explainFileError(Object.assign(new Error('EACCES'), { code: 'EACCES' }), 'save')).toMatch(/permission|allowed/i)
    expect(explainFileError(Object.assign(new Error('EBUSY'), { code: 'EBUSY' }), 'save')).toMatch(/open in another app|in use/i)
    expect(explainFileError(Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }), 'save')).toMatch(/space/i)
    expect(explainFileError(new Error('something odd'), 'save')).toBe('something odd')
  })
})

describe('odd progress output', () => {
  it('copes with N/A, negative and past-the-end times', () => {
    const parse = createFfmpegProgressParser(10)
    expect(parse('out_time_us=N/A\nspeed=N/A\nprogress=continue\n')).toEqual({ progress: 0, speed: undefined, eta: undefined, done: false })
    expect(parse('out_time_us=-9223372036854775808\nprogress=continue\n')).toMatchObject({ progress: 0 })
    expect(parse('out_time_us=25000000\nspeed=1.0x\nprogress=continue\n')).toMatchObject({ progress: 0.999, eta: 0 })
    expect(parse('out_time_us=25000000\nprogress=end\n')).toMatchObject({ progress: 1, done: true })
  })

  it('handles Windows line endings and a missing progress key', () => {
    const parse = createFfmpegProgressParser(4)
    expect(parse('frame=1\r\nout_time_us=2000000\r\nprogress=continue\r\n')).toMatchObject({ progress: 0.5 })
    expect(parse('frame=2\r\n')).toBeUndefined()
  })

  it('reads yt-dlp lines full of NA', () => {
    expect(parseYtDlpLine('SPARKY|NA|NA|NA|NA|NA|NA')).toEqual({ kind: 'download', downloaded: 0, total: undefined, speed: undefined, eta: undefined, item: undefined })
    expect(parseYtDlpLine('SPARKY|500|100|NA|None|NA|1')).toMatchObject({ downloaded: 500, total: 100, item: 1 })
  })

  it('reads ffprobe output with no duration or N/A', () => {
    expect(parseFfprobe(JSON.stringify({ format: { duration: 'N/A' }, streams: [{ codec_type: 'audio' }] })).duration).toBeUndefined()
    expect(parseFfprobe(JSON.stringify({ streams: [] }))).toEqual({ duration: undefined, width: undefined, height: undefined, hasAudio: false, hasVideo: false })
  })
})

describe('odd names and paths', () => {
  it('ignores dots in folder names when there is no extension', () => {
    expect(normalizeExt('C:\\my.videos\\clip')).toBe('')
    expect(categoryOf('C:\\v2.0\\notes')).toBeUndefined()
    expect(categoryOf('C:\\my.videos\\clip.MOV')).toBe('video')
    expect(normalizeExt('/home/me/photos.2024/IMG.HEIC')).toBe('heic')
  })

  it('names outputs for dotfiles, trailing dots and unicode', () => {
    expect(outputName('.hidden', 'mp4', () => false)).toBe('.hidden.mp4')
    expect(outputName('clip.', 'mp4', () => false)).toBe('clip.mp4')
    expect(outputName('日本語 clip (1) [x].mov', 'mp4', (n) => n === '日本語 clip (1) [x].mp4')).toBe('日本語 clip (1) [x] (2).mp4')
  })
})

describe('1440p and 4K at the boundaries', () => {
  const gpu = { encoders: ['h264_nvenc'] }

  it('treats a source exactly at 1440 as 1440p-capable, one pixel short as not', () => {
    const at = resolutionOptions({ sourceHeight: 1440, performance: 'max', gpu, codec: 'h264' })
    expect(at.find((o) => o.value === 1440)!.hidden).toBe(false)
    expect(at.find((o) => o.value === 2160)!.hidden).toBe(true)
    const short = resolutionOptions({ sourceHeight: 1439, performance: 'max', gpu, codec: 'h264' })
    expect(short.find((o) => o.value === 1440)!.hidden).toBe(true)
  })

  it('hides nothing when the source size is unknown or zero', () => {
    for (const sourceHeight of [undefined, 0]) {
      const opts = resolutionOptions({ sourceHeight, performance: 'max', gpu, codec: 'h264' })
      expect(opts.every((o) => !o.hidden)).toBe(true)
    }
  })

  it('explains a lock without naming encoders', () => {
    const noGpu = resolutionOptions({ sourceHeight: 2160, performance: 'max', gpu: { encoders: [] }, codec: 'hevc' })
    const reason = noGpu.find((o) => o.value === 2160)!.reason!
    expect(reason).toMatch(/graphics card/i)
    expect(reason).not.toMatch(/nvenc|amf|qsv|hevc/i)
    const notMax = resolutionOptions({ sourceHeight: 2160, performance: 'low', gpu, codec: 'h264' })
    expect(notMax.find((o) => o.value === 1440)!.reason).toMatch(/Max/)
  })
})

describe('plain words on every label', () => {
  it('keeps performance descriptions free of hardware jargon', () => {
    for (const l of PERFORMANCE_LEVELS) {
      expect(l.description).not.toMatch(JARGON)
      expect(l.outcome).not.toMatch(JARGON)
    }
  })

  it('keeps the Max-without-graphics-card note plain', () => {
    const base: ConvertSettings = { output: 'mp4', compression: 2, resolution: null, performance: 'max', originals: 'keep', advanced: {} }
    const p = buildFfmpegPlan({ input: 'in.mov', output: 'out.mp4', settings: base, defaultCodec: 'h264', gpu: { encoders: [] }, cores: 8 })
    expect(p.notes[0]).toMatch(/graphics card/i)
    expect(p.notes[0]).not.toMatch(JARGON)
  })
})
