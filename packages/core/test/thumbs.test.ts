import { describe, expect, it } from 'vitest'
import { ValidationError, thumbsArgs, validateThumbsOptions } from '../src'

describe('thumbsArgs', () => {
  it('seeks before -i for a poster', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'poster', width: 640, at: 12 })
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-ss') + 1]).toBe('12')
    expect(args).toContain('out.png')
  })

  it('takes exactly one frame for a poster', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'poster', width: 320 })
    expect(args[args.indexOf('-frames:v') + 1]).toBe('1')
  })

  it('spaces sprite frames across the whole clip', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'sprite', width: 160, count: 50 }, 100)
    expect(args[args.indexOf('-vf') + 1]).toMatch(/^fps=0\.500000,/)
  })

  it('lays the sprite out as a grid tall enough for every frame', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'sprite', width: 160, count: 23, columns: 5 }, 60)
    expect(args[args.indexOf('-vf') + 1]).toContain('tile=5x5')
  })

  it('falls back to one frame per second when the duration probe failed', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'sprite', width: 160, count: 10 }, 0)
    expect(args[args.indexOf('-vf') + 1]).toMatch(/^fps=1\.000000,/)
  })

  it('bounds a preview by -t after -i', () => {
    const args = thumbsArgs('in.mp4', 'out.webp', { mode: 'preview', width: 480, at: 5, durationSec: 3, fps: 12 })
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args.indexOf('-t')).toBeGreaterThan(args.indexOf('-i'))
    expect(args[args.indexOf('-t') + 1]).toBe('3')
    expect(args[args.indexOf('-vf') + 1]).toContain('fps=12')
  })

  it('loops a preview', () => {
    const args = thumbsArgs('in.mp4', 'out.webp', { mode: 'preview', width: 480 })
    expect(args[args.indexOf('-loop') + 1]).toBe('0')
  })

  it('is an array of discrete tokens', () => {
    const args = thumbsArgs('in.mp4', 'out.png', { mode: 'sprite', width: 160 }, 30)
    for (const a of args) expect(typeof a).toBe('string')
  })
})

describe('validateThumbsOptions', () => {
  it('accepts each mode', () => {
    for (const mode of ['poster', 'sprite', 'preview'] as const) {
      expect(() => validateThumbsOptions({ mode, width: 320 })).not.toThrow()
    }
  })

  it('rejects an unknown mode', () => {
    expect(() => validateThumbsOptions({ mode: 'contact-sheet' as never, width: 320 })).toThrow(ValidationError)
  })

  it('rejects a negative seek', () => {
    expect(() => validateThumbsOptions({ mode: 'poster', width: 320, at: -1 })).toThrow(ValidationError)
  })

  it('accepts a wide sheet of many frames', () => {
    expect(() => validateThumbsOptions({ mode: 'sprite', width: 1024, columns: 20 })).not.toThrow()
    expect(() => validateThumbsOptions({ mode: 'sprite', width: 160, count: 500, columns: 50 })).not.toThrow()
  })

  it('accepts a long preview', () => {
    expect(() => validateThumbsOptions({ mode: 'preview', width: 480, durationSec: 600 })).not.toThrow()
  })

  it('still rejects a zero count, zero columns or a width below 16', () => {
    expect(() => validateThumbsOptions({ mode: 'sprite', width: 160, count: 0 })).toThrow(ValidationError)
    expect(() => validateThumbsOptions({ mode: 'sprite', width: 160, columns: 0 })).toThrow(ValidationError)
    expect(() => validateThumbsOptions({ mode: 'poster', width: 8 })).toThrow(ValidationError)
  })
})
