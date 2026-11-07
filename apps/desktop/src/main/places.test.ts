import { describe, expect, it } from 'vitest'
import { drives, quickAccess } from './places'

describe('places', () => {
  it('lists the known folders and the Sparky output folder', () => {
    const got = quickAccess((name) => `C:\\Users\\me\\${name}`, 'D:\\out')
    expect(got.map((p) => p.label)).toEqual(['Desktop', 'Downloads', 'Documents', 'Pictures', 'Sparky'])
    expect(got.at(-1)).toEqual({ label: 'Sparky', path: 'D:\\out', icon: 'sparky' })
  })

  it('lists the drive roots that exist', () => {
    expect(drives((p) => p === 'C:\\' || p === 'D:\\')).toEqual([
      { label: 'C:', path: 'C:\\', icon: 'drive' },
      { label: 'D:', path: 'D:\\', icon: 'drive' },
    ])
  })
})
