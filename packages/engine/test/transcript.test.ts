import { TRANSCRIPT_TEXT } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { allOps, inputSchema, opById } from '../src'

describe('transcript op', () => {
  it('is registered, takes links and needs yt-dlp', () => {
    const op = opById('transcript')
    expect(op).toBeDefined()
    expect(op!.requires).toEqual(['yt-dlp'])
    expect(op!.positional).toEqual(['urls'])
    expect(allOps().map((o) => o.id)).toContain('transcript')
  })

  it('says several links make several files, so `out` cannot name one file', () => {
    const op = opById('transcript')!
    expect(op.many?.({ urls: ['a', 'b'] })).toBe(true)
    expect(op.many?.({ urls: ['a'] })).toBe(false)
  })

  it('words every field and tells the agent nothing is downloaded but captions', () => {
    const props = inputSchema(opById('transcript')!).properties as Record<string, { title?: string; description?: string }>
    for (const name of ['urls', 'langs', 'timestamps']) {
      expect(props[name]!.title, name).toBeTruthy()
      expect(props[name]!.description, name).toBeTruthy()
    }
    expect(TRANSCRIPT_TEXT.fields.urls.description).toMatch(/captions/)
  })
})
