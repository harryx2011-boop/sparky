import { describe, expect, it } from 'vitest'
import { unpackedPath } from '../../src/ocr/tesseract'

describe('unpackedPath', () => {
  it('points a worker script inside app.asar at app.asar.unpacked, with Windows separators', () => {
    expect(unpackedPath('C:\\Users\\a\\AppData\\Local\\Programs\\Sparky\\resources\\app.asar\\node_modules\\tesseract.js\\src\\worker-script\\node\\index.js')).toBe(
      'C:\\Users\\a\\AppData\\Local\\Programs\\Sparky\\resources\\app.asar.unpacked\\node_modules\\tesseract.js\\src\\worker-script\\node\\index.js',
    )
  })

  it('handles forward slashes and leaves paths outside an archive alone', () => {
    expect(unpackedPath('/opt/Sparky/resources/app.asar/node_modules/x.js')).toBe('/opt/Sparky/resources/app.asar.unpacked/node_modules/x.js')
    expect(unpackedPath('D:\\sparky\\node_modules\\tesseract.js\\src\\index.js')).toBe('D:\\sparky\\node_modules\\tesseract.js\\src\\index.js')
    expect(unpackedPath('C:\\x\\app.asar.unpacked\\y.js')).toBe('C:\\x\\app.asar.unpacked\\y.js')
  })
})
