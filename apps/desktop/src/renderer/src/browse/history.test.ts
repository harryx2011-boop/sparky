import { describe, expect, it } from 'vitest'
import { back, canBack, canForward, current, forward, open, recall, remember } from './history'
import { NONE, pick } from './selection'

describe('history', () => {
  it('S6: Alt+Left then Alt+Right shows A, then B, each with its earlier selection', () => {
    let h = open(null, 'C:\\A')
    const inA = pick(['x', 'y'], NONE, 'y', {})
    remember(current(h).id, inA)
    h = open(h, 'C:\\B')
    const inB = pick(['p', 'q'], NONE, 'p', {})
    remember(current(h).id, inB)

    h = back(h)
    expect(current(h).path).toBe('C:\\A')
    expect(recall(current(h).id)).toEqual(inA)

    h = forward(h)
    expect(current(h).path).toBe('C:\\B')
    expect(recall(current(h).id)).toEqual(inB)
  })

  it('opening a folder after going back drops the forward entries', () => {
    let h = open(open(open(null, 'C:\\A'), 'C:\\B'), 'C:\\C')
    h = back(back(h))
    h = open(h, 'C:\\D')
    expect(h.entries.map((e) => e.path)).toEqual(['C:\\A', 'C:\\D'])
    expect(canForward(h)).toBe(false)
  })

  it('opening the folder already shown adds no entry', () => {
    const h = open(null, 'C:\\A')
    expect(open(h, 'C:\\A')).toBe(h)
  })

  it('back and forward stop at the ends', () => {
    const h = open(null, 'C:\\A')
    expect(canBack(h)).toBe(false)
    expect(back(h)).toBe(h)
    expect(forward(h)).toBe(h)
  })

  it('a revisited folder gets a fresh entry with no remembered selection', () => {
    let h = open(open(null, 'C:\\A'), 'C:\\B')
    h = open(h, 'C:\\A')
    expect(recall(current(h).id)).toBeUndefined()
  })
})
