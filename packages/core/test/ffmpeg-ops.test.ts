import { describe, expect, it } from 'vitest'
import { bitrateForTarget, compressArgs, convertArgs, gifArgs } from '../src'

describe('argv construction', () => {
  const args = convertArgs('in.mov', 'out.mp4', 'mp4', { crf: 23 }, 'mov')

  it('is an array of discrete tokens for spawn', () => {
    expect(Array.isArray(args)).toBe(true)
    for (const a of args) expect(typeof a).toBe('string')
  })

  it('names the input and ends with the output path', () => {
    expect(args).toContain('in.mov')
    expect(args.at(-1)).toBe('out.mp4')
  })

  it('places trim flags before -i so ffmpeg seeks instead of decoding', () => {
    const trimmed = convertArgs('i.mp4', 'o.mp4', 'mp4', { trim: { start: 5, end: 9 } }, 'mp4')
    expect(trimmed.indexOf('-ss')).toBeLessThan(trimmed.indexOf('-i'))
    expect(trimmed[trimmed.indexOf('-t') + 1]).toBe('4')
  })

  it('builds filters from validated numerics only', () => {
    const a = convertArgs('i.mp4', 'o.mp4', 'mp4', { width: 1280, rotate: 90, flip: 'h' }, 'mp4')
    expect(a[a.indexOf('-vf') + 1]).toBe('scale=1280:-2,hflip,transpose=1')
  })

  it('puts crop before scale and fps last', () => {
    const a = convertArgs('i.mp4', 'o.mp4', 'mp4', { crop: { x: 10, y: 20, width: 640, height: 360 }, height: 720, fps: 30 }, 'mp4')
    expect(a[a.indexOf('-vf') + 1]).toBe('crop=640:360:10:20,scale=-2:720,fps=30')
  })

  it('drops the video stream for an audio target', () => {
    const a = convertArgs('i.mp4', 'o.mp3', 'mp3', {}, 'mp4')
    expect(a).toContain('-vn')
    expect(a).toContain('libmp3lame')
  })

  it('strips audio when asked', () => {
    const a = convertArgs('i.mp4', 'o.mp4', 'mp4', { stripAudio: true }, 'mp4')
    expect(a).toContain('-an')
    expect(a).not.toContain('-c:a')
  })

  it('emits machine-readable progress on stdout', () => {
    expect(args[args.indexOf('-progress') + 1]).toBe('pipe:1')
  })
})

describe('webm output with native ffmpeg', () => {
  it('encodes VP9 with row multithreading and Opus audio', () => {
    const a = convertArgs('i.mp4', 'o.webm', 'webm', { crf: 31 }, 'mp4')
    expect(a[a.indexOf('-c:v') + 1]).toBe('libvpx-vp9')
    expect(a[a.indexOf('-row-mt') + 1]).toBe('1')
    expect(a[a.indexOf('-c:a') + 1]).toBe('libopus')
  })

  it('runs VP9 in constant-quality mode when only crf is given', () => {
    const a = convertArgs('i.mp4', 'o.webm', 'webm', { crf: 31 }, 'mp4')
    expect(a[a.indexOf('-b:v') + 1]).toBe('0')
  })

  it('keeps a solved bitrate for VP9 instead of zeroing it', () => {
    const a = convertArgs('i.mp4', 'o.webm', 'webm', { targetBytes: 5_000_000 }, 'mp4', 60)
    expect(Number(a[a.indexOf('-b:v') + 1])).toBeGreaterThan(0)
  })
})

describe('gif two-pass', () => {
  const b = gifArgs('in.mp4', 'p.png', { fps: 15, width: 480, loop: true, dither: 'sierra2_4a' })

  it('generates a palette before rendering', () => {
    expect(b.palette.join(' ')).toContain('palettegen')
    expect(b.render('p.png', 'out.gif').join(' ')).toContain('paletteuse')
  })

  it('produces a plain string array for the render pass', () => {
    const rendered = b.render('p.png', 'out.gif')
    expect(Array.isArray(rendered)).toBe(true)
    for (const a of rendered) expect(typeof a).toBe('string')
  })

  it('loops forever or plays once', () => {
    const once = gifArgs('in.mp4', 'p.png', { fps: 10, width: 320, loop: false, dither: 'none' }).render('p.png', 'o.gif')
    expect(once[once.indexOf('-loop') + 1]).toBe('-1')
    const looped = b.render('p.png', 'o.gif')
    expect(looped[looped.indexOf('-loop') + 1]).toBe('0')
  })
})

describe('target-size bitrate on the convert and compress paths', () => {
  it('solves for a bitrate that lands under the target', () => {
    const bitrate = bitrateForTarget(10 * 1024 * 1024, 60, 128_000)!
    expect(((bitrate + 128_000) * 60) / 8).toBeLessThan(10 * 1024 * 1024)
  })

  it('prefers the solved bitrate over crf when a target is set', () => {
    const a = compressArgs('i.mp4', 'o.mp4', 'mp4', { target: 10_485_760, crf: 23 }, 'mp4', 60)
    expect(a).toContain('-b:v')
    expect(a).not.toContain('-crf')
  })

  it('picks crf by quality preset when no target is set', () => {
    const crfOf = (quality: 'archive' | 'web' | 'email') => {
      const a = compressArgs('i.mp4', 'o.mp4', 'mp4', { quality }, 'mp4', 60)
      return a[a.indexOf('-crf') + 1]
    }
    expect(crfOf('archive')).toBe('18')
    expect(crfOf('web')).toBe('26')
    expect(crfOf('email')).toBe('23')
  })

  it('solves a bitrate when a format change and a target are requested together', () => {
    const a = convertArgs('i.mov', 'o.mp4', 'mp4', { targetBytes: 5_000_000 }, 'mov', 60)
    expect(a).toContain('-b:v')
    expect(a).not.toContain('-crf')
  })

  it('leaves crf alone when the duration is unknown', () => {
    const a = convertArgs('i.mov', 'o.mp4', 'mp4', { targetBytes: 5_000_000, crf: 23 }, 'mov', 0)
    expect(a[a.indexOf('-crf') + 1]).toBe('23')
    expect(a).not.toContain('-b:v')
  })

  it('ignores a size target for an audio-only output', () => {
    const a = convertArgs('i.mp4', 'o.mp3', 'mp3', { targetBytes: 5_000_000 }, 'mp4', 60)
    expect(a).toContain('-vn')
    expect(a).not.toContain('-b:v')
  })
})
