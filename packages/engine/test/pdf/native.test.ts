// A native module that fails to load (sharp, @napi-rs/canvas) must not stop the pdf ops, and so the registry, from loading.
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('sharp')
  vi.doUnmock('@napi-rs/canvas')
  vi.resetModules()
})

describe('pdf ops without their native modules', () => {
  it('still load', async () => {
    vi.resetModules()
    vi.doMock('sharp', () => {
      throw new Error('sharp failed to load')
    })
    vi.doMock('@napi-rs/canvas', () => {
      throw new Error('canvas failed to load')
    })
    const { pdfOps } = await import('../../src/ops/pdf')
    expect(pdfOps.map((o) => o.id)).toContain('pdf.merge')
  })
})
