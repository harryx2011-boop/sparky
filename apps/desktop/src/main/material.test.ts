// Which window material the shell gets: the Windows 11 acrylic, or the painted Frost wall everywhere else.
import { describe, expect, it } from 'vitest'
import { windowMaterial } from './material'

describe('windowMaterial', () => {
  it('uses the OS material on Windows 11 22H2 and later', () => {
    expect(windowMaterial('win32', '10.0.22621', undefined)).toBe('os')
    expect(windowMaterial('win32', '10.0.26200', undefined)).toBe('os')
  })

  it('paints the wall on Windows 10 and early Windows 11', () => {
    expect(windowMaterial('win32', '10.0.19045', undefined)).toBe('none')
    expect(windowMaterial('win32', '10.0.22000', undefined)).toBe('none')
  })

  it('paints the wall off Windows', () => {
    expect(windowMaterial('linux', '6.8.0', undefined)).toBe('none')
  })

  it('SPARKY_MATERIAL=none forces the painted wall', () => {
    expect(windowMaterial('win32', '10.0.26200', 'none')).toBe('none')
  })
})
