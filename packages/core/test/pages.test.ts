import { describe, expect, it } from 'vitest'
import { isSinglePage, parsePageGroups, parsePageRanges } from '../src'

describe('parsePageRanges', () => {
  it('reads numbers, ranges and open ends', () => {
    expect(parsePageRanges('1-3,5,8-', 10)).toEqual([1, 2, 3, 5, 8, 9, 10])
    expect(parsePageRanges(' -2 ; 4 ', 5)).toEqual([1, 2, 4])
    expect(parsePageRanges('5-last', 6)).toEqual([5, 6])
    expect(parsePageRanges('last', 6)).toEqual([6])
  })

  it('treats an empty spec and "all" as every page', () => {
    expect(parsePageRanges('', 3)).toEqual([1, 2, 3])
    expect(parsePageRanges('  ', 3)).toEqual([1, 2, 3])
    expect(parsePageRanges('ALL', 3)).toEqual([1, 2, 3])
  })

  it('knows odd and even', () => {
    expect(parsePageRanges('odd', 5)).toEqual([1, 3, 5])
    expect(parsePageRanges('even', 5)).toEqual([2, 4])
  })

  it('keeps the written order, once per page', () => {
    expect(parsePageRanges('3,1,2,3', 3)).toEqual([3, 1, 2])
    expect(parsePageRanges('4-2', 5)).toEqual([4, 3, 2])
  })

  it('stops an overlong range at the last page', () => {
    expect(parsePageRanges('2-100', 4)).toEqual([2, 3, 4])
  })

  it('explains what is wrong in plain words', () => {
    expect(() => parsePageRanges('7', 5)).toThrow(/has 5 pages, so there is no page 7/)
    expect(() => parsePageRanges('6-', 5)).toThrow(/no page 6/)
    expect(() => parsePageRanges('0', 5)).toThrow(/isn’t a list of pages/)
    expect(() => parsePageRanges('a-b', 5)).toThrow(/“a-b”/)
    expect(() => parsePageRanges('-', 5)).toThrow(/isn’t a list/)
    expect(() => parsePageRanges('1 2', 5)).toThrow(/isn’t a list/)
    expect(() => parsePageRanges('even', 1)).toThrow(/No pages of this PDF match “even”/)
  })
})

describe('parsePageGroups', () => {
  it('keeps each part as its own group', () => {
    expect(parsePageGroups('1-3,4-6', 6)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ])
    expect(parsePageGroups('odd,even', 3)).toEqual([[1, 3], [2]])
  })

  it('drops parts that match nothing but keeps the rest', () => {
    expect(parsePageGroups('1,even', 1)).toEqual([[1]])
  })
})

describe('isSinglePage', () => {
  it('is true only for one page number', () => {
    expect(isSinglePage('3')).toBe(true)
    expect(isSinglePage(' 12 ')).toBe(true)
    expect(isSinglePage('1-2')).toBe(false)
    expect(isSinglePage('last')).toBe(false)
    expect(isSinglePage(undefined)).toBe(false)
  })
})
