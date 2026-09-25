import { describe, expect, it } from 'vitest'
import { canConvert, categoryOf, compressionApplies, engineFor, INPUT_EXTS, isCompressOnly, isSupportedInput, normalizeExt, outputsFor, resolutionApplies } from '../src'

describe('formats', () => {
  it('normalizes extensions and aliases', () => {
    expect(normalizeExt('Photo.JPEG')).toBe('jpg')
    expect(normalizeExt('.htm')).toBe('html')
    expect(normalizeExt('mp4')).toBe('mp4')
  })

  it('finds the category of common files', () => {
    expect(categoryOf('C:\\clips\\trip-recap.mov')).toBe('video')
    expect(categoryOf('interview.wav')).toBe('audio')
    expect(categoryOf('IMG_0001.HEIC')).toBe('image')
    expect(categoryOf('notes.md')).toBe('document')
    expect(categoryOf('old.rar')).toBe('archive')
    expect(categoryOf('scan.tiff')).toBe('image')
    expect(categoryOf('setup.exe')).toBeUndefined()
    expect(categoryOf('folder')).toBeUndefined()
  })

  it('offers only valid outputs', () => {
    expect(outputsFor('a.mov').map((f) => f.ext)).toContain('mp3')
    expect(outputsFor('a.rar').map((f) => f.ext)).toEqual(['zip', '7z', 'folder'])
    expect(outputsFor('a.pdf').map((f) => f.ext)).toEqual(['pdf', 'txt', 'md', 'html'])
    expect(outputsFor('a.csv').map((f) => f.ext)).toEqual(['xlsx', 'json', 'xml', 'html', 'md', 'txt', 'pdf'])
    expect(outputsFor('a.xls').map((f) => f.ext)).toEqual(['pdf', 'xlsx'])
    expect(outputsFor('a.md').map((f) => f.ext)).not.toContain('md')
    expect(outputsFor('a.heic').map((f) => f.ext)).not.toContain('heic')
    expect(canConvert('a.wav', 'png')).toBe(false)
  })

  it('treats the same format as "just shrink it"', () => {
    expect(isCompressOnly('a.mp4', 'mp4')).toBe(true)
    expect(canConvert('a.mp4', 'mp4')).toBe(true)
    expect(isCompressOnly('a.jpeg', 'jpg')).toBe(true)
  })

  it('knows when compression and resolution apply', () => {
    expect(compressionApplies('wav')).toBe(false)
    expect(compressionApplies('pdf', { ghostscript: false })).toBe(false)
    expect(compressionApplies('pdf', { ghostscript: true })).toBe(true)
    expect(compressionApplies('zip')).toBe(true)
    expect(resolutionApplies('mp4')).toBe(true)
    expect(resolutionApplies('gif')).toBe(false)
    expect(resolutionApplies('mp3')).toBe(false)
  })

  it('picks the right tool', () => {
    expect(engineFor('a.png', 'webp')).toBe('sharp')
    expect(engineFor('a.heic', 'jpg')).toBe('ffmpeg')
    expect(engineFor('a.png', 'ico')).toBe('ffmpeg')
    expect(engineFor('a.md', 'pdf')).toBe('pdf-print')
    expect(engineFor('a.docx', 'pdf', { libreoffice: true })).toBe('libreoffice')
    expect(engineFor('a.docx', 'md')).toBe('pandoc')
    expect(engineFor('a.pdf', 'pdf')).toBe('ghostscript')
    expect(engineFor('a.pdf', 'txt')).toBe('pdf-text')
    expect(engineFor('a.zip', '7z')).toBe('7zip')
    expect(engineFor('a.mp3', 'png')).toBeUndefined()
    // The document module takes the data formats and pdf to html; every pair that worked before keeps its engine.
    for (const [from, to] of [['csv', 'xlsx'], ['csv', 'pdf'], ['xlsx', 'csv'], ['json', 'xml'], ['xml', 'json'], ['xml', 'html'], ['pdf', 'html']] as [string, string][]) {
      expect(engineFor(`a.${from}`, to), `${from} to ${to}`).toBe('document')
    }
    expect(engineFor('a.md', 'html')).toBe('pandoc')
    expect(engineFor('a.txt', 'pdf')).toBe('pdf-print')
    expect(engineFor('a.pdf', 'md')).toBe('pdf-text')
    expect(engineFor('a.xls', 'pdf')).toBeUndefined()
    expect(engineFor('a.xls', 'pdf', { libreoffice: true })).toBe('libreoffice')
    expect(engineFor('a.csv', 'docx')).toBeUndefined()
  })

  it('lists every extension it reads, and only those', () => {
    for (const ext of ['mp4', 'png', 'jpeg', 'tif', 'tiff', 'heic', 'htm', 'markdown', 'wma', 'xls', 'doc', 'rtf', 'odt', 'ods', 'ppt', 'pptx', 'odp', 'csv', 'rar']) {
      expect(INPUT_EXTS, ext).toContain(ext)
    }
    expect(INPUT_EXTS).not.toContain('folder')
    expect(new Set(INPUT_EXTS).size).toBe(INPUT_EXTS.length)
    for (const ext of INPUT_EXTS) expect(isSupportedInput(`a.${ext}`), ext).toBe(true)
  })

  it('offers TIFF as an image output, written by sharp', () => {
    expect(outputsFor('a.png').map((f) => f.ext)).toContain('tiff')
    expect(outputsFor('scan.tif').map((f) => f.ext)).toContain('tiff')
    expect(engineFor('a.png', 'tiff')).toBe('sharp')
    expect(engineFor('a.tif', 'png')).toBe('sharp')
    expect(engineFor('a.heic', 'tiff')).toBe('ffmpeg')
    expect(compressionApplies('tiff')).toBe(false)
  })

  it('lights up Office files only when LibreOffice is there', () => {
    const office: [string, string[]][] = [
      ['doc', ['pdf', 'docx']],
      ['rtf', ['pdf', 'docx']],
      ['odt', ['pdf', 'docx']],
      ['ods', ['pdf', 'xlsx']],
      ['xls', ['pdf', 'xlsx']],
      ['ppt', ['pdf']],
      ['pptx', ['pdf']],
      ['odp', ['pdf']],
    ]
    for (const [from, targets] of office) {
      expect(categoryOf(`a.${from}`), from).toBe('document')
      expect(outputsFor(`a.${from}`).map((f) => f.ext), from).toEqual(targets)
      for (const to of targets) {
        expect(engineFor(`a.${from}`, to), `${from} to ${to}`).toBeUndefined()
        expect(engineFor(`a.${from}`, to, { libreoffice: true }), `${from} to ${to}`).toBe('libreoffice')
      }
      expect(engineFor(`a.${from}`, 'md', { libreoffice: true }), `${from} to md`).toBeUndefined()
    }
    // Word files keep their existing routes; LibreOffice only takes over their PDF when it is there.
    expect(engineFor('a.docx', 'pdf')).toBe('pdf-print')
    expect(engineFor('a.docx', 'md', { libreoffice: true })).toBe('pandoc')
  })
})
