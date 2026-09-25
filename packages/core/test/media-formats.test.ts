import { describe, expect, it } from 'vitest'
import { MEDIA_FORMATS, isMediaFormat, mediaKindOf } from '../src'

describe('media format set', () => {
  it('accepts every declared format and rejects anything else', () => {
    for (const f of MEDIA_FORMATS) expect(isMediaFormat(f)).toBe(true)
    expect(isMediaFormat('exe')).toBe(false)
    expect(isMediaFormat('heic')).toBe(false)
  })

  it('offers webm as an output, since native ffmpeg encodes VP9', () => {
    expect(isMediaFormat('webm')).toBe(true)
    expect(mediaKindOf('webm')).toBe('video')
  })

  it('classifies every format into exactly one kind', () => {
    expect(mediaKindOf('mp4')).toBe('video')
    expect(mediaKindOf('mp3')).toBe('audio')
    expect(mediaKindOf('jpg')).toBe('image')
    expect(mediaKindOf('gif')).toBe('gif')
    expect(mediaKindOf('apng')).toBe('gif')
    for (const f of MEDIA_FORMATS) expect(['video', 'audio', 'image', 'gif']).toContain(mediaKindOf(f))
  })
})
