import { describe, expect, it } from 'vitest'
import { firstStarting, moveTo, NONE, pick, selectAll, targetIndex, toOpen, typed } from './selection'

const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
const names = (sel: { names: ReadonlySet<string> }) => [...sel.names].sort()

describe('selection', () => {
  it('S8: click one row, then Shift-click the fifth, selects five rows', () => {
    const one = pick(order, NONE, 'b', {})
    const five = pick(order, one, 'f', { shift: true })
    expect(names(five)).toEqual(['b', 'c', 'd', 'e', 'f'])
    expect(five.names.size).toBe(5)
    expect(five.anchor).toBe('b')
    expect(five.cursor).toBe('f')
  })

  it('S8: Shift-click works upward from the anchor', () => {
    const sel = pick(order, pick(order, NONE, 'e', {}), 'c', { shift: true })
    expect(names(sel)).toEqual(['c', 'd', 'e'])
  })

  it('S8: Ctrl-click adds and removes single rows and moves the anchor', () => {
    let sel = pick(order, NONE, 'a', {})
    sel = pick(order, sel, 'c', { ctrl: true })
    expect(names(sel)).toEqual(['a', 'c'])
    sel = pick(order, sel, 'a', { ctrl: true })
    expect(names(sel)).toEqual(['c'])
    expect(sel.anchor).toBe('a')
  })

  it('S8: Ctrl+Shift-click adds a range to what is already selected', () => {
    let sel = pick(order, NONE, 'a', {})
    sel = pick(order, sel, 'e', { ctrl: true })
    sel = pick(order, sel, 'g', { ctrl: true, shift: true })
    expect(names(sel)).toEqual(['a', 'e', 'f', 'g'])
  })

  it('a plain click replaces the selection', () => {
    const sel = pick(order, selectAll(order), 'd', {})
    expect(names(sel)).toEqual(['d'])
  })

  it('Ctrl+A selects every row', () => {
    expect(selectAll(order).names.size).toBe(order.length)
  })

  it('arrow keys move by the view step and stop at the ends', () => {
    expect(targetIndex('ArrowDown', 2, 7, { down: 1, across: 0 })).toBe(3)
    expect(targetIndex('ArrowUp', 0, 7, { down: 1, across: 0 })).toBe(0)
    expect(targetIndex('ArrowRight', 2, 7, { down: 3, across: 1 })).toBe(3)
    expect(targetIndex('ArrowDown', 5, 7, { down: 3, across: 1 })).toBe(6)
    expect(targetIndex('ArrowRight', 2, 7, { down: 1, across: 0 })).toBeNull()
    expect(targetIndex('Home', 4, 7, { down: 1, across: 0 })).toBe(0)
    expect(targetIndex('End', 1, 7, { down: 1, across: 0 })).toBe(6)
    expect(targetIndex('ArrowDown', -1, 7, { down: 1, across: 0 })).toBe(0)
    expect(targetIndex('ArrowDown', 0, 0, { down: 1, across: 0 })).toBeNull()
    expect(targetIndex('KeyX', 0, 7, { down: 1, across: 0 })).toBeNull()
  })

  it('Shift+arrow extends from the anchor; Ctrl+arrow only moves the cursor', () => {
    const start = pick(order, NONE, 'b', {})
    expect(names(moveTo(order, start, 3, { shift: true }))).toEqual(['b', 'c', 'd'])
    const moved = moveTo(order, start, 3, { ctrl: true })
    expect(names(moved)).toEqual(['b'])
    expect(moved.cursor).toBe('d')
    expect(names(moveTo(order, start, 3, {}))).toEqual(['d'])
  })
})

describe('type to select', () => {
  const files = ['Alpha.txt', 'readme.md', 'Report 2.pdf', 'report.docx', 'zeta']

  it('S7: typing "rep" picks the first name that starts with it', () => {
    let buffer = typed(null, 'r', 1000)
    buffer = typed(buffer, 'e', 1100)
    buffer = typed(buffer, 'p', 1200)
    expect(buffer.text).toBe('rep')
    expect(firstStarting(files, buffer.text)).toBe('Report 2.pdf')
  })

  it('S7: a pause of a second starts a new search', () => {
    expect(typed(typed(null, 'r', 0), 'z', 1500).text).toBe('z')
  })

  it('S7: no match selects nothing', () => {
    expect(firstStarting(files, 'q')).toBeNull()
  })
})

describe('open', () => {
  const rows = [
    { name: 'Photos', dir: true },
    { name: 'a.txt', dir: false },
    { name: 'b.pdf', dir: false },
  ]

  it('S9: one selected folder opens in the pane', () => {
    expect(toOpen(rows, new Set(['Photos']))).toEqual({ folder: rows[0], files: [] })
  })

  it('S9: selected files open in their default apps', () => {
    expect(toOpen(rows, new Set(['a.txt']))).toEqual({ folder: null, files: [rows[1]] })
    expect(toOpen(rows, new Set(['Photos', 'a.txt', 'b.pdf']))).toEqual({ folder: null, files: [rows[1], rows[2]] })
  })
})
