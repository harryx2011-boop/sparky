import type { OpSummary } from '@sparky/core'
import { describe, expect, it } from 'vitest'
import { fieldsOf, initial, toArgs } from './ops'

function op(properties: Record<string, unknown>, required: string[] = ['files'], extra: Partial<OpSummary> = {}): OpSummary {
  return {
    id: 'test',
    label: 'Test',
    doneLabel: 'Done',
    category: 'pdf',
    kind: 'tool',
    arity: 'each',
    positional: ['files'],
    requires: [],
    accepts: ['pdf'],
    available: true,
    missing: [],
    inputSchema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, ...properties, out: { type: 'string' } }, required },
    ...extra,
  }
}

describe('initial', () => {
  it('starts a switch at its schema default', () => {
    const fields = fieldsOf(op({ allowPrint: { type: 'boolean', default: true }, fade: { type: 'boolean' } }))
    expect(initial(fields)).toMatchObject({ allowPrint: true, fade: false, files: [] })
  })

  it('starts numbers at their default as text and leaves the rest empty', () => {
    const fields = fieldsOf(op({ every: { type: 'integer', default: 2 }, width: { type: 'integer' } }))
    expect(initial(fields)).toMatchObject({ every: '2', width: '' })
  })
})

describe('toArgs', () => {
  it('sends false when a default-on switch is turned off', () => {
    const fields = fieldsOf(op({ allowPrint: { type: 'boolean', default: true } }))
    expect(toArgs(fields, { ...initial(fields), files: ['a.pdf'], allowPrint: false })).toEqual({ files: ['a.pdf'], allowPrint: false })
  })

  it('always sends a switch that has a default', () => {
    const fields = fieldsOf(op({ allowPrint: { type: 'boolean', default: true }, loop: { type: 'boolean', default: false } }))
    expect(toArgs(fields, { ...initial(fields), files: ['a.pdf'] })).toEqual({ files: ['a.pdf'], allowPrint: true, loop: false })
  })

  it('leaves out an untouched switch with no default, and sends it once on', () => {
    const fields = fieldsOf(op({ fade: { type: 'boolean' } }))
    expect(toArgs(fields, { ...initial(fields), files: ['a.pdf'] })).toEqual({ files: ['a.pdf'] })
    expect(toArgs(fields, { ...initial(fields), files: ['a.pdf'], fade: true })).toEqual({ files: ['a.pdf'], fade: true })
  })

  it('turns number text into numbers and drops empty fields', () => {
    const fields = fieldsOf(op({ every: { type: 'integer' }, ranges: { type: 'string' }, pages: { type: 'array', items: { type: 'integer' } } }))
    expect(toArgs(fields, { files: ['a.pdf'], every: '3', ranges: '', pages: [] })).toEqual({ files: ['a.pdf'], every: 3 })
  })
})

describe('fieldsOf', () => {
  it('marks secret fields and reads choice labels from the schema', () => {
    const fields = fieldsOf(
      op({ password: { type: 'string' }, flip: { type: 'string', enum: ['h', 'v', 'hv'], labels: { h: 'Side to side', v: 'Upside down' } } }, ['files'], { secret: ['password'] }),
    )
    expect(fields.find((f) => f.key === 'password')?.secret).toBe(true)
    expect(fields.find((f) => f.key === 'flip')?.options?.map((o) => o.label)).toEqual(['Side to side', 'Upside down', 'Hv'])
  })
})
