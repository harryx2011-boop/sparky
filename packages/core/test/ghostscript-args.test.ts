import { describe, expect, it } from 'vitest'
import { ghostscriptArgs } from '../src'

describe('ghostscriptArgs', () => {
  it('escapes % in the output path, which Ghostscript reads as a page-number pattern', () => {
    const args = ghostscriptArgs('C:/100% done/a.pdf', 'C:/100% done/b.pdf', 2)
    expect(args).toContain('-sOutputFile=C:/100%% done/b.pdf')
    expect(args.at(-1)).toBe('C:/100% done/a.pdf')
  })
})
