import { describe, expect, it } from 'vitest'
import { BATCH_MAX, batchConcurrency, defaultSettings } from '../src'

describe('batch conversion', () => {
  it('is on by default', () => {
    expect(defaultSettings('/root').batch).toBe(true)
    expect('concurrency' in defaultSettings('/root')).toBe(false)
  })

  it('runs one job at a time when batch is off, whatever the level', () => {
    expect(batchConcurrency('low', 16, false)).toBe(1)
    expect(batchConcurrency('normal', 16, false)).toBe(1)
    expect(batchConcurrency('max', 16, false)).toBe(1)
  })

  it('keeps Low to one job and Normal to two', () => {
    expect(batchConcurrency('low', 16, true)).toBe(1)
    expect(batchConcurrency('normal', 2, true)).toBe(2)
    expect(batchConcurrency('normal', 32, true)).toBe(2)
  })

  it('gives Max about half the processor, between two and four jobs', () => {
    expect(batchConcurrency('max', 1, true)).toBe(2)
    expect(batchConcurrency('max', 2, true)).toBe(2)
    expect(batchConcurrency('max', 4, true)).toBe(2)
    expect(batchConcurrency('max', 6, true)).toBe(3)
    expect(batchConcurrency('max', 8, true)).toBe(4)
    expect(batchConcurrency('max', 32, true)).toBe(BATCH_MAX)
    expect(BATCH_MAX).toBe(4)
  })

  it('never returns a fraction or zero for odd inputs', () => {
    expect(batchConcurrency('max', 0, true)).toBe(2)
    expect(batchConcurrency('max', 5, true)).toBe(3)
    expect(batchConcurrency('max', Number.NaN, true)).toBe(2)
  })
})
