import { describe, expect, it } from 'vitest'
import { asLink, explainYtDlpError, isKnownMediaLink, parseLinkInfo, parseYtDlpLine, planDownload, postprocessLabel, type DownloadRequest } from '../src'

const req: DownloadRequest = {
  url: 'https://www.youtube.com/watch?v=abc',
  mode: 'video',
  quality: 1080,
  compression: 2,
  performance: 'normal',
  extras: { thumbnail: true, subtitles: 'off', subtitleLangs: ['en'], metadata: true, sponsorBlock: false },
}
const ctx = { outputDir: 'C:\\Users\\me\\Documents\\Sparky\\Downloads', ffmpegDir: 'C:\\bin' }
const arg = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

describe('links', () => {
  it('accepts a single http link', () => {
    expect(asLink('  https://youtu.be/abc ')).toBe('https://youtu.be/abc')
    expect(asLink('hello world')).toBeUndefined()
    expect(asLink('ftp://example.com/a')).toBeUndefined()
    expect(asLink('https://localhost/a')).toBeUndefined()
  })

  it('recognises media sites for the clipboard chip', () => {
    expect(isKnownMediaLink('https://music.youtube.com/watch?v=1')).toBe(true)
    expect(isKnownMediaLink('https://www.tiktok.com/@a/video/1')).toBe(true)
    expect(isKnownMediaLink('https://example.com/video')).toBe(false)
  })
})

describe('planDownload', () => {
  it('caps video quality and prefers MP4', () => {
    const p = planDownload(req, ctx)
    expect(arg(p.args, '-S')).toBe('res:1080,ext:mp4:m4a')
    expect(arg(p.args, '--merge-output-format')).toBe('mp4')
    expect(arg(p.args, '--ffmpeg-location')).toBe('C:\\bin')
    expect(p.args).toContain('--embed-thumbnail')
    expect(p.args.slice(-2)).toEqual(['--', req.url])
    expect(p.convertAfter).toBeUndefined()
  })

  it('lets yt-dlp extract audio at the compression bitrate', () => {
    const p = planDownload({ ...req, mode: 'audio', convertTo: 'mp3', compression: 0 }, ctx)
    expect(p.args).toContain('-x')
    expect(arg(p.args, '--audio-format')).toBe('mp3')
    expect(arg(p.args, '--audio-quality')).toBe('320K')
    expect(p.convertAfter).toBeUndefined()
  })

  it('hands video conversions to Sparky as a second stage', () => {
    expect(planDownload({ ...req, convertTo: 'webm' }, ctx).convertAfter).toBe('webm')
    expect(planDownload({ ...req, convertTo: 'gif' }, ctx).convertAfter).toBe('gif')
  })

  it('adds extras and picked playlist items', () => {
    const p = planDownload(
      { ...req, items: [1, 3, 4], extras: { thumbnail: false, subtitles: 'embed', subtitleLangs: ['en', 'fr'], metadata: false, sponsorBlock: true } },
      ctx,
    )
    expect(arg(p.args, '--playlist-items')).toBe('1,3,4')
    expect(arg(p.args, '--sub-langs')).toBe('en,fr')
    expect(p.args).toContain('--embed-subs')
    expect(arg(p.args, '--sponsorblock-remove')).toBe('sponsor,intro,selfpromo')
    expect(p.args).not.toContain('--embed-thumbnail')
  })
})

describe('parsing', () => {
  it('reads a single video preview', () => {
    const info = parseLinkInfo(
      JSON.stringify({
        title: 'Clip', uploader: 'Chan', duration: 222, thumbnail: 't.jpg', extractor_key: 'Youtube',
        formats: [
          { height: 2160, vcodec: 'vp9', acodec: 'none', filesize: 500 },
          { height: 1080, vcodec: 'avc1', acodec: 'none', filesize: 200 },
          { vcodec: 'none', acodec: 'opus', filesize: 20 },
        ],
        subtitles: { en: [], live_chat: [] },
      }),
      'u',
    )
    expect(info).toMatchObject({ kind: 'single', title: 'Clip', maxHeight: 2160, sizeEstimate: 520, subtitleLangs: ['en'] })
  })

  it('reads a playlist preview', () => {
    const info = parseLinkInfo(
      JSON.stringify({ _type: 'playlist', title: 'Mix', uploader: 'Chan', entries: [{ id: 'a', title: 'One', duration: 60 }, null, { id: 'b', title: 'Two', duration: 30 }] }),
      'u',
    )
    expect(info.kind).toBe('playlist')
    expect(info.entries.map((e) => e.index)).toEqual([1, 3])
    expect(info.duration).toBe(90)
  })

  it('reads progress, post-processing and file lines', () => {
    expect(parseYtDlpLine('SPARKY|1048576|NA|4194304|524288.5|6|2')).toEqual({ kind: 'download', downloaded: 1048576, total: 4194304, speed: 524288.5, eta: 6, item: 2 })
    expect(parseYtDlpLine('SPARKY|pp|ExtractAudio|started')).toEqual({ kind: 'postprocess', name: 'ExtractAudio', status: 'started' })
    expect(parseYtDlpLine('SPARKYFILE|C:\\a b\\c.mp3')).toEqual({ kind: 'file', path: 'C:\\a b\\c.mp3' })
    expect(parseYtDlpLine('[youtube] abc: Downloading webpage')).toBeUndefined()
    expect(postprocessLabel('FFmpegExtractAudio')).toBe('Converting audio')
  })

  it('explains errors in plain words', () => {
    expect(explainYtDlpError('ERROR: Unsupported URL: https://x')).toMatchObject({ suggestUpdate: true })
    expect(explainYtDlpError('ERROR: [youtube] abc: Video unavailable')).toMatchObject({ suggestUpdate: false })
    expect(explainYtDlpError('ERROR: [youtube] abc: nsig extraction failed').message).toMatch(/Updating/)
  })
})
