import { describe, expect, it } from 'vitest'
import { isKnownMediaLink, SITES, siteFor } from '../src'

describe('sites', () => {
  it('names the site a link points at, subdomains included', () => {
    expect(siteFor('https://www.youtube.com/watch?v=1')?.id).toBe('youtube')
    expect(siteFor('https://music.youtube.com/watch?v=1')?.id).toBe('youtube')
    expect(siteFor('https://youtu.be/1')?.name).toBe('YouTube')
    expect(siteFor('https://twitter.com/a/status/1')?.id).toBe('x')
    expect(siteFor('https://fb.watch/abc')?.id).toBe('facebook')
    expect(siteFor('https://vm.tiktok.com/abc')?.id).toBe('tiktok')
  })

  it('does not match look-alike hosts or junk', () => {
    expect(siteFor('https://notyoutube.com/x')).toBeUndefined()
    expect(siteFor('https://youtube.com.evil.example/x')).toBeUndefined()
    expect(siteFor('nonsense')).toBeUndefined()
    expect(isKnownMediaLink('https://example.com/video')).toBe(false)
  })

  it('keeps one row per site with unique ids and hosts', () => {
    const ids = SITES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    const hosts = SITES.flatMap((s) => s.hosts)
    expect(new Set(hosts).size).toBe(hosts.length)
    for (const s of SITES) expect(s.name.trim().length, s.id).toBeGreaterThan(0)
  })
})
