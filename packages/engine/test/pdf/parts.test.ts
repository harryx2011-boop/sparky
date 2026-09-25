// The pure pieces under the pdf ops: page layout, split plans, Ghostscript arguments, PNG row filters.
import { describe, expect, it } from 'vitest'
import { unpredictPng } from '../../src/pdf/extract-images'
import { argFileEntry, argFileText, commandLine, explainGhostscriptError, flattenArgs, passwordToken, permissionBits, protectArgs, unlockArgs } from '../../src/pdf/ghostscript'
import { mmToPt, placeImage } from '../../src/pdf/layout'
import { splitParts } from '../../src/pdf/ops/split'

/** A port of Ghostscript's @file reader (base/gsargs.c, arg_next, depth > 0), to check what it makes of our argfile. */
function readArgFile(text: string): string[] {
  const out: string[] = []
  let p = 0
  const next = () => (p < text.length ? text[p++] : undefined)
  const space = (c: string | undefined) => c !== undefined && /\s/.test(c)
  let c = next()
  for (;;) {
    while (space(c)) c = next()
    if (c === undefined) return out
    let s = ''
    let inQuote = false
    let eol = true
    let prevEq = false
    for (;;) {
      if (c === undefined) {
        if (inQuote) throw new Error(`Unterminated quote in @-file: ${s}`)
        break
      }
      if (!inQuote && space(c)) break
      if (c === '#' && eol) {
        while (c !== undefined && c !== '\r' && c !== '\n') c = next()
        if (c === '\r') c = next()
        if (c === '\n') c = next()
        prevEq = false
        continue
      }
      if (c === '\\') {
        c = next()
        if (c === '\r' || c === '\n') {
          if (c === '\r') c = next()
          if (c === '\n') c = next()
          eol = true
          prevEq = false
          continue
        }
        if (c === '"') {
          s += '"'
          c = next()
        } else s += '\\'
        eol = false
        prevEq = false
        continue
      }
      if (c === '"') {
        if ((s.length === 0 || prevEq) && !inQuote) inQuote = true
        else if (inQuote) {
          c = next()
          if (space(c)) break
          s += '"'
          eol = false
          prevEq = false
          continue
        } else s += c
      } else s += c
      eol = c === '\r' || c === '\n'
      prevEq = c === '=' || c === '#'
      c = next()
    }
    out.push(s)
    if (space(c)) c = next()
  }
}

describe('placeImage', () => {
  it('makes a fit page the picture’s size at its DPI plus margins', () => {
    expect(placeImage(300, 150, 150, { pageSize: 'fit', orientation: 'auto', marginMm: 0, fit: 'contain' })).toMatchObject({ pageWidth: 144, pageHeight: 72, x: 0, y: 0 })
    const m = mmToPt(10)
    expect(placeImage(72, 72, 72, { pageSize: 'fit', orientation: 'landscape', marginMm: 10, fit: 'contain' })).toMatchObject({ pageWidth: 72 + 2 * m, x: m, y: m })
  })

  it('centres a contained picture and clips a covering one', () => {
    const contain = placeImage(1000, 500, 72, { pageSize: 'letter', orientation: 'portrait', marginMm: 0, fit: 'contain' })
    expect(contain).toMatchObject({ pageWidth: 612, pageHeight: 792, width: 612, height: 306, x: 0, y: 243 })
    expect(contain.clip).toBeUndefined()
    const cover = placeImage(1000, 500, 72, { pageSize: 'letter', orientation: 'portrait', marginMm: 0, fit: 'cover' })
    expect(cover).toMatchObject({ height: 792, width: 1584, x: -486 })
    expect(cover.clip).toEqual({ x: 0, y: 0, width: 612, height: 792 })
  })

  it('turns the paper for wide pictures on auto, and refuses a margin wider than the page', () => {
    expect(placeImage(800, 600, 72, { pageSize: 'a4', orientation: 'auto', marginMm: 0, fit: 'contain' }).pageWidth).toBeCloseTo(841.89)
    expect(placeImage(600, 800, 72, { pageSize: 'a4', orientation: 'landscape', marginMm: 0, fit: 'contain' }).pageWidth).toBeCloseTo(841.89)
    expect(() => placeImage(10, 10, 72, { pageSize: 'a4', orientation: 'auto', marginMm: 200, fit: 'contain' })).toThrow(/smaller margin/)
  })
})

describe('splitParts', () => {
  it('defaults to ranges when given, else one file per page', () => {
    expect(splitParts({ ranges: '1-2,5' }, 5).map((p) => [p.pages, p.suffix])).toEqual([
      [[1, 2], ' (pages 1-2)'],
      [[5], ' (page 5)'],
    ])
    expect(splitParts({}, 3).map((p) => p.suffix)).toEqual([' (page 1)', ' (page 2)', ' (page 3)'])
  })

  it('names non-contiguous parts by number and drops an empty even half', () => {
    expect(splitParts({ mode: 'ranges', ranges: '1,3,odd' }, 12).map((p) => p.suffix)).toEqual([' (page 1)', ' (page 3)', ' (part 3)'])
    expect(splitParts({ mode: 'odd_even' }, 1)).toEqual([{ pages: [1], suffix: ' (odd pages)' }])
    expect(splitParts({ mode: 'every', every: 4 }, 10).map((p) => p.pages.length)).toEqual([4, 4, 2])
  })

  it('never gives two parts the same name', () => {
    const twice = splitParts({ ranges: '1-3,1-3' }, 5).map((p) => p.suffix)
    expect(new Set(twice).size).toBe(2)
    const pages = splitParts({ ranges: '2,2,2' }, 5).map((p) => p.suffix)
    expect(new Set(pages).size).toBe(3)
    expect(pages[0]).toBe(' (page 2)')
  })
})

describe('ghostscript arguments', () => {
  it('computes the /P permission bits', () => {
    expect(permissionBits({ print: false, copy: false })).toBe(-3136)
    expect(permissionBits({ print: true, copy: false })).toBe(-3136 | 4 | 2048)
    expect(permissionBits({ print: true, copy: true })).toBe(-3136 | 4 | 2048 | 16)
    // Bits 1 and 2 must stay clear, 7 and 8 set.
    expect(permissionBits({ print: true, copy: true }) & 3).toBe(0)
    expect(permissionBits({ print: false, copy: false }) & 0xc0).toBe(0xc0)
  })

  it('sets a random owner password when none is given, and never a user password that wasn’t', () => {
    const call = protectArgs('in.pdf', 'out.pdf', { print: true, copy: false, userPassword: 'open' })
    expect(call.secret).toContain('-dUserPassword=<6f70656e>')
    expect(call.secret.find((a) => a.startsWith('-dOwnerPassword='))).toMatch(/^-dOwnerPassword=<[0-9a-f]{32}>$/)
    expect(call.args.slice(-2)).toEqual(['-sOutputFile=out.pdf', 'in.pdf'])
    const ownerOnly = protectArgs('in.pdf', 'out.pdf', { print: false, copy: false, ownerPassword: 'boss' })
    expect(ownerOnly.secret).toEqual(['-dOwnerPassword=<626f7373>'])
    expect(unlockArgs('in.pdf', 'out.pdf').secret).toEqual([])
    expect(unlockArgs('in.pdf', 'out.pdf', 'pw').secret).toEqual(['-dPDFPassword=<7077>'])
    expect(flattenArgs('in.pdf', 'out.pdf').args).toContain('-dPreserveAnnots=false')
  })

  it('writes passwords as their Latin-1 bytes, the encoding RC4 PDF passwords use, and refuses other letters', () => {
    expect(passwordToken('café')).toBe('<636166e9>')
    expect(() => passwordToken('пароль')).toThrow(/Western European/)
    expect(() => protectArgs('in.pdf', 'out.pdf', { print: true, copy: true, userPassword: '密码' })).toThrow(/Western European/)
  })

  it('escapes % in output paths, which Ghostscript reads as a page-number pattern', () => {
    const out = 'C:/100% done/out.pdf'
    const want = '-sOutputFile=C:/100%% done/out.pdf'
    expect(protectArgs('in.pdf', out, { print: true, copy: true, userPassword: 'x' }).args).toContain(want)
    expect(unlockArgs('in.pdf', out).args).toContain(want)
    expect(flattenArgs('in.pdf', out).args).toContain(want)
    expect(flattenArgs('C:/100% done/in.pdf', 'o.pdf').args.at(-1)).toBe('C:/100% done/in.pdf')
  })

  it('keeps passwords off the command line, behind an @argfile', () => {
    const call = protectArgs('in.pdf', 'out.pdf', { print: true, copy: true, userPassword: 'hunter 2', ownerPassword: 'boss' })
    const line = commandLine(call, 'C:/tmp/gs-1.args')
    expect(line[0]).toBe('@C:/tmp/gs-1.args')
    expect(line.join(' ')).not.toMatch(/Password=/)
    expect(commandLine(unlockArgs('in.pdf', 'out.pdf'), undefined)[0]).toBe('-sDEVICE=pdfwrite')
  })

  it('writes an @argfile Ghostscript reads back to the exact passwords', () => {
    const tricky = ['plain', 'two words', 'quote"inside', '"leading', 'ends\\', 'back\\slash', 'a\\"b', ' spaced ', '#hash', 'tab\there', 'ünïcödé', 'x=y"z', '\\"', '"']
    const args = tricky.map((p) => `-sUserPassword=${p}`)
    expect(readArgFile(argFileText(args))).toEqual(args)
  })

  it('refuses what the @argfile can’t carry, in plain words', () => {
    expect(argFileEntry('-sUserPassword=line\nbreak')).toBeUndefined()
    expect(argFileEntry('-sUserPassword=space and slash\\')).toBeUndefined()
    expect(() => argFileText(['-sUserPassword=a\nb'])).toThrow(/Choose a different password/)
  })

  it('explains a password failure in plain words', () => {
    const locked = 'This file requires a password for access.'
    expect(explainGhostscriptError(locked, { intent: 'unlock', password: true })).toMatch(/That password doesn’t open this PDF/)
    expect(explainGhostscriptError(locked, { intent: 'unlock', password: false })).toMatch(/needs its password/)
    for (const intent of ['protect', 'compress', 'flatten'] as const) expect(explainGhostscriptError(locked, { intent })).toMatch(/password protected\. Remove the password/)
    expect(explainGhostscriptError('**** Error: Couldn\'t initialise file.', { intent: 'compress' })).toMatch(/damaged/)
  })
})

describe('unpredictPng', () => {
  it('undoes Sub, Up, Average and Paeth rows', () => {
    // Two rows of three grey pixels: 10 20 30 / 15 25 35.
    const rows = [
      [1, 10, 10, 10], // Sub
      [2, 5, 5, 5], // Up
    ]
    expect([...unpredictPng(Uint8Array.from(rows.flat()), 3, 1)]).toEqual([10, 20, 30, 15, 25, 35])
    const avg = [0, 10, 20, 30, 3, 10, 10, 10]
    expect([...unpredictPng(Uint8Array.from(avg), 3, 1)]).toEqual([10, 20, 30, 15, 27, 38])
    const paeth = [0, 10, 20, 30, 4, 5, 5, 5]
    expect([...unpredictPng(Uint8Array.from(paeth), 3, 1)]).toEqual([10, 20, 30, 15, 25, 35])
  })
})
