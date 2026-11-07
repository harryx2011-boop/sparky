import { describe, expect, it } from 'vitest'
import { pageStatusText, selectedText, setPageStatus, subscribePageStatus } from './pageStatus'

describe('page status', () => {
  it('S8: says how many items are selected, and nothing when none are', () => {
    expect(selectedText(5)).toBe('5 selected')
    expect(selectedText(1234)).toBe('1,234 selected')
    expect(selectedText(0)).toBeNull()
  })

  it('tells listeners when the text changes, and only then', () => {
    let calls = 0
    const off = subscribePageStatus(() => calls++)
    setPageStatus('5 selected')
    setPageStatus('5 selected')
    expect(pageStatusText()).toBe('5 selected')
    setPageStatus(null)
    off()
    setPageStatus('gone')
    expect(calls).toBe(2)
    setPageStatus(null)
  })
})
