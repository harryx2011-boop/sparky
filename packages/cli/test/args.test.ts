import { describe, expect, it } from 'vitest'
import { bindArgs, coerceArray, coerceValue, kebab, missingRequired, parseArgv, suggest, type BindSpec, type JsonSchema } from '../src/args'
import { UsageError } from '../src/errors'

const flags = (argv: string[], booleans: string[] = []) => Object.fromEntries(parseArgv(argv, { booleans: new Set(booleans) }).flags)

describe('parseArgv', () => {
  it('reads --flag v and --flag=v', () => {
    expect(flags(['--a', '1', '--b=two'])).toEqual({ a: ['1'], b: ['two'] })
  })

  it('keeps everything after = including more = signs', () => {
    expect(flags(['--pages=1-3=x'])).toEqual({ pages: ['1-3=x'] })
  })

  it('reads a bare flag at the end as true', () => {
    expect(flags(['--json'])).toEqual({ json: [true] })
  })

  it('reads a flag followed by another flag as true', () => {
    expect(flags(['--json', '--local'])).toEqual({ json: [true], local: [true] })
  })

  it('turns --no-x into x: false', () => {
    expect(flags(['--no-wait', '--no-merge'])).toEqual({ wait: [false], merge: [false] })
  })

  it('keeps a declared flag that starts with no-', () => {
    expect(flags(['--no-op'], ['no-op'])).toEqual({ 'no-op': [true] })
  })

  it('collects repeated flags in order', () => {
    expect(flags(['--size', '16', '--size', '32'])).toEqual({ size: ['16', '32'] })
  })

  it('never lets a boolean flag swallow the next word', () => {
    const r = parseArgv(['--json', 'a.png'], { booleans: new Set(['json']) })
    expect(r.positionals).toEqual(['a.png'])
    expect(r.flags.get('json')).toEqual([true])
  })

  it('takes a negative number as a value', () => {
    expect(flags(['--volume', '-3'])).toEqual({ volume: ['-3'] })
  })

  it('treats everything after -- as positional', () => {
    const r = parseArgv(['a', '--', '--weird.pdf', '-x'])
    expect(r.positionals).toEqual(['a', '--weird.pdf', '-x'])
    expect(r.flags.size).toBe(0)
  })

  it('maps -h to help and -o to out', () => {
    expect(flags(['-h'])).toEqual({ help: [true] })
    expect(flags(['-o', 'x.pdf'])).toEqual({ out: ['x.pdf'] })
  })

  it('keeps a lone dash as a positional', () => {
    expect(parseArgv(['-']).positionals).toEqual(['-'])
  })
})

describe('coercion', () => {
  it('types numbers and rejects words', () => {
    expect(coerceValue('2.5', { type: 'number' }, '--x')).toBe(2.5)
    expect(() => coerceValue('fast', { type: 'number' }, '--x')).toThrow(/takes a number/)
  })

  it('rejects a fraction for an integer', () => {
    expect(coerceValue('7', { type: 'integer' }, '--x')).toBe(7)
    expect(() => coerceValue('7.5', { type: 'integer' }, '--x')).toThrow(/whole number/)
  })

  it('reads booleans in several spellings', () => {
    const s: JsonSchema = { type: 'boolean' }
    expect(coerceValue(true, s, '--x')).toBe(true)
    expect(coerceValue('no', s, '--x')).toBe(false)
    expect(coerceValue('ON', s, '--x')).toBe(true)
    expect(() => coerceValue('maybe', s, '--x')).toThrow(/true or false/)
  })

  it('matches an enum case-insensitively and names the choices when wrong', () => {
    const s: JsonSchema = { type: 'string', enum: ['fit', 'a4'] }
    expect(coerceValue('A4', s, '--page-size')).toBe('a4')
    expect(() => coerceValue('a5', s, '--page-size')).toThrow('--page-size must be one of: fit, a4 (got "a5").')
  })

  it('types a union of literals by its constants', () => {
    const s: JsonSchema = { anyOf: [{ type: 'string', const: 'source' }, { type: 'number', const: 720 }, { type: 'number', const: 1080 }] }
    expect(coerceValue('1080', s, '--resolution')).toBe(1080)
    expect(coerceValue('source', s, '--resolution')).toBe('source')
    expect(() => coerceValue('480', s, '--resolution')).toThrow(/one of: source, 720, 1080/)
  })

  it('tries each branch of a mixed union', () => {
    const s: JsonSchema = { anyOf: [{ type: 'number' }, { type: 'string', enum: ['auto'] }] }
    expect(coerceValue('12', s, '--x')).toBe(12)
    expect(coerceValue('auto', s, '--x')).toBe('auto')
  })

  it('refuses a missing value and a --no- form for a non-boolean', () => {
    expect(() => coerceValue(true, { type: 'string' }, '--out')).toThrow('--out needs a value.')
    expect(() => coerceValue(false, { type: 'number' }, '--dpi')).toThrow(/no --no- form/)
  })

  it('splits commas between numbers in an array, not between words', () => {
    expect(coerceArray(['16,32', '48'], { type: 'array', items: { type: 'integer' } }, '--sizes')).toEqual([16, 32, 48])
    expect(coerceArray(['a,b.png'], { type: 'array', items: { type: 'string' } }, '--files')).toEqual(['a,b.png'])
  })

  it('turns camelCase and snake_case into kebab-case', () => {
    expect(kebab('trimStart')).toBe('trim-start')
    expect(kebab('videoKbps')).toBe('video-kbps')
    expect(kebab('odd_even')).toBe('odd-even')
  })
})

const spec: BindSpec = {
  command: 'sparky test run',
  positional: ['files'],
  aliases: { to: 'output' },
  reserved: ['json', 'wait', 'local', 'help'],
  schema: {
    required: ['files', 'output'],
    properties: {
      files: { type: 'array', items: { type: 'string' } },
      output: { type: 'string' },
      trimStart: { type: 'number', minimum: 0 },
      merge: { type: 'boolean', default: true },
      sizes: { type: 'array', items: { type: 'integer' } },
      out: { type: 'string' },
    },
  },
}

describe('bindArgs', () => {
  it('fills positionals, kebab flags and aliases, typed', () => {
    const r = bindArgs(['a.mp4', 'b.mp4', '--to', 'webm', '--trim-start', '5', '--no-merge', '--out', 'x/'], spec)
    expect(r.args).toEqual({ files: ['a.mp4', 'b.mp4'], output: 'webm', trimStart: 5, merge: false, out: 'x/' })
  })

  it('accepts the camelCase spelling too', () => {
    expect(bindArgs(['a', '--output=mp4', '--trimStart', '1'], spec).args).toMatchObject({ output: 'mp4', trimStart: 1 })
  })

  it('keeps reserved flags apart from the args', () => {
    const r = bindArgs(['a', '--json', '--no-wait', '--local'], spec)
    expect(r.reserved).toEqual({ json: true, wait: false, local: true })
    expect(r.args).toEqual({ files: ['a'] })
  })

  it('suggests the flag it thinks was meant', () => {
    expect(() => bindArgs(['a', '--trim-strat', '1'], spec)).toThrow(/Did you mean --trim-start\?/)
  })

  it('refuses a single-value flag given twice', () => {
    expect(() => bindArgs(['a', '--output', 'mp4', '--output', 'webm'], spec)).toThrow(UsageError)
  })

  it('lets a boolean sit before a positional', () => {
    expect(bindArgs(['--merge', 'a.png'], spec).args).toEqual({ merge: true, files: ['a.png'] })
  })

  it('merges positional files with --files flags', () => {
    expect(bindArgs(['a', '--files', 'b'], spec).args.files).toEqual(['a', 'b'])
  })

  it('refuses extra words when the op takes no positionals', () => {
    expect(() => bindArgs(['stray'], { ...spec, positional: [] })).toThrow(/doesn't take "stray"/)
  })

  it('stops at --help without checking the rest', () => {
    expect(bindArgs(['--help', '--bogus', 'x'], spec)).toEqual({ args: {}, reserved: { help: true } })
  })

  it('names the missing required inputs', () => {
    expect(missingRequired({ files: [] }, spec)).toEqual(['<files>', '--output'])
    expect(missingRequired({ files: ['a'], output: 'mp4' }, spec)).toEqual([])
  })
})

describe('suggest', () => {
  it('finds a swapped-letter typo and ignores distant words', () => {
    expect(suggest('mrege', ['merge', 'split'])).toBe('merge')
    expect(suggest('zzzzz', ['merge', 'split'])).toBeUndefined()
  })
})
