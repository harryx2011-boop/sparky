import { describe, expect, it } from 'vitest'
import { decideIcon, hashPng, iconExt, NONSENSE_EXT } from './icon-pick'

const png = Buffer.from('real icon bytes')
const genericPng = Buffer.from('unknown type icon')

describe('decideIcon', () => {
  it('returns the icon as a PNG data URL when Windows has a specific one', () => {
    expect(decideIcon({ png, blank: false }, hashPng(genericPng))).toEqual({ kind: 'icon', dataUrl: `data:image/png;base64,${png.toString('base64')}` })
  })

  it('answers none, to cache, for the unknown-type icon and for a blank one', () => {
    expect(decideIcon({ png: genericPng, blank: false }, hashPng(genericPng))).toEqual({ kind: 'none' })
    expect(decideIcon({ png: Buffer.alloc(0), blank: true }, hashPng(genericPng))).toEqual({ kind: 'none' })
  })

  it('asks for a retry when the probe failed or the baseline is missing', () => {
    expect(decideIcon(null, hashPng(genericPng))).toEqual({ kind: 'retry' })
    expect(decideIcon({ png, blank: false }, null)).toEqual({ kind: 'retry' })
  })
})

describe('iconExt', () => {
  it('normalises a safe extension and refuses anything that could leave the probe folder', () => {
    expect(iconExt('.PDF ')).toBe('pdf')
    expect(iconExt('7z')).toBe('7z')
    for (const bad of ['../x', 'a/b', 'a\\b', '', 'x'.repeat(17), NONSENSE_EXT, 42, null]) expect(iconExt(bad)).toBeNull()
  })
})
