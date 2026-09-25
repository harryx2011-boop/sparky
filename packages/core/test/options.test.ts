import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  bitrateForTarget,
  validateCompressOptions,
  validateConvertOptions,
  validateGifOptions,
  validateImageOptions,
  validateMediaFormat,
} from '../src'

const SHELL_SHAPED_FORMAT = ['mp4', 'rm', '-rf', '/'].join(';')

describe('media format validation', () => {
  it('rejects anything outside the closed set', () => {
    expect(() => validateMediaFormat('exe')).toThrow(ValidationError)
    expect(() => validateMediaFormat(SHELL_SHAPED_FORMAT)).toThrow(ValidationError)
  })

  it('accepts a known format', () => {
    expect(validateMediaFormat('mp4')).toBe('mp4')
    expect(validateMediaFormat('webm')).toBe('webm')
  })
})

describe('convert option ranges', () => {
  it('rejects out-of-range crf', () => {
    expect(() => validateConvertOptions({ crf: 99 })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ crf: -1 })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ crf: 23 })).not.toThrow()
  })

  it('accepts any large dimension and rejects one below 16', () => {
    expect(() => validateConvertOptions({ width: 999_999 })).not.toThrow()
    expect(() => validateConvertOptions({ width: 7680, height: 4320 })).not.toThrow()
    expect(() => validateConvertOptions({ width: 8 })).toThrow(ValidationError)
  })

  it('accepts a crop anywhere in a large frame', () => {
    expect(() => validateConvertOptions({ crop: { x: 40_000, y: 40_000, width: 20_000, height: 20_000 } })).not.toThrow()
    expect(() => validateConvertOptions({ crop: { x: -1, y: 0, width: 100, height: 100 } })).toThrow(ValidationError)
  })

  it('rejects a trim whose end precedes its start, and accepts a long one', () => {
    expect(() => validateConvertOptions({ trim: { start: 10, end: 5 } })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ trim: { start: 5, end: 10 } })).not.toThrow()
    expect(() => validateConvertOptions({ trim: { start: 0, end: 200_000 } })).not.toThrow()
  })

  it('accepts any high bitrate and rejects one too low to encode', () => {
    expect(() => validateConvertOptions({ videoBitrate: 900_000_000, audioBitrate: 5_000_000 })).not.toThrow()
    expect(() => validateConvertOptions({ videoBitrate: 10 })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ audioBitrate: 10 })).toThrow(ValidationError)
  })

  it('rejects an unknown preset, rotate or flip value', () => {
    expect(() => validateConvertOptions({ preset: 'evil' as never })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ rotate: 45 as never })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ flip: 'xy' as never })).toThrow(ValidationError)
  })

  it('rejects a non-finite number', () => {
    expect(() => validateConvertOptions({ crf: NaN })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ fps: Infinity })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ targetBytes: Infinity })).toThrow(ValidationError)
  })

  it('keeps the fps range', () => {
    expect(() => validateConvertOptions({ fps: 0 })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ fps: 241 })).toThrow(ValidationError)
    expect(() => validateConvertOptions({ fps: 60 })).not.toThrow()
  })

  it('accepts any large target size', () => {
    expect(() => validateConvertOptions({ targetBytes: 50 * 1024 ** 3 })).not.toThrow()
  })
})

describe('compress options', () => {
  it('rejects an unknown quality preset', () => {
    expect(() => validateCompressOptions({ quality: 'ultra' as never })).toThrow(ValidationError)
  })

  it('rejects a target too small to encode and accepts a very large one', () => {
    expect(() => validateCompressOptions({ target: 10 })).toThrow(ValidationError)
    expect(() => validateCompressOptions({ target: 100 * 1024 ** 3 })).not.toThrow()
  })
})

describe('gif options', () => {
  it('rejects an out-of-range fps or an unknown dither algorithm', () => {
    expect(() => validateGifOptions({ fps: 500, width: 480, loop: true, dither: 'sierra2_4a' })).toThrow(ValidationError)
    expect(() => validateGifOptions({ fps: 51, width: 480, loop: true, dither: 'bayer' })).toThrow(ValidationError)
    expect(() => validateGifOptions({ fps: 15, width: 480, loop: true, dither: 'evil' as never })).toThrow(ValidationError)
    expect(() => validateGifOptions({ fps: 15, width: 480, loop: true, dither: 'bayer' })).not.toThrow()
  })

  it('accepts a wide GIF', () => {
    expect(() => validateGifOptions({ fps: 15, width: 20_000, loop: true, dither: 'bayer' })).not.toThrow()
  })
})

describe('image options', () => {
  it('rejects an out-of-range quality', () => {
    expect(() => validateImageOptions({ quality: 0 })).toThrow(ValidationError)
    expect(() => validateImageOptions({ quality: 101 })).toThrow(ValidationError)
    expect(() => validateImageOptions({ quality: 82 })).not.toThrow()
  })

  it('rejects an unknown fit mode', () => {
    expect(() => validateImageOptions({ fit: 'squeeze' as never })).toThrow(ValidationError)
  })

  it('accepts a very large output size', () => {
    expect(() => validateImageOptions({ width: 30_000, height: 30_000 })).not.toThrow()
  })
})

describe('target-size bitrate solver', () => {
  it('solves a bitrate that lands under the target', () => {
    const bitrate = bitrateForTarget(10 * 1024 * 1024, 60, 128_000)!
    const predicted = ((bitrate + 128_000) * 60) / 8
    expect(predicted).toBeLessThan(10 * 1024 * 1024)
    expect(predicted).toBeGreaterThan(8 * 1024 * 1024)
  })

  it('refuses a target too small to encode', () => {
    expect(bitrateForTarget(64_000, 3600, 128_000)).toBeNull()
  })

  it('returns null for an unknown duration', () => {
    expect(bitrateForTarget(10_000_000, 0, 128_000)).toBeNull()
  })
})

describe('validation messages', () => {
  it('never talk about limits or maximums', () => {
    const probes = [
      () => validateConvertOptions({ crf: 99 }),
      () => validateConvertOptions({ width: 8 }),
      () => validateConvertOptions({ targetBytes: 1 }),
      () => validateCompressOptions({ target: 1 }),
      () => validateImageOptions({ quality: 0 }),
    ]
    const messages: string[] = []
    for (const probe of probes) {
      try {
        probe()
      } catch (e) {
        messages.push((e as Error).message)
      }
    }
    expect(messages).toHaveLength(probes.length)
    for (const m of messages) expect(m).not.toMatch(/limit|maximum|exceed/i)
  })
})
