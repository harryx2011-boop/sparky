import { describe, expect, it } from 'vitest'
import { pickCaptionFile, planTranscript, vttToText } from '../src'

const MANUAL = `WEBVTT
Kind: captions
Language: en

00:00:01.200 --> 00:00:03.360
All right, so here we are, in front of the
elephants

00:00:05.318 --> 00:00:07.974
the cool thing about these guys
`

const ROLLING = `WEBVTT
Kind: captions
Language: en

00:00:00.160 --> 00:00:02.000 align:start position:0%
so<00:00:00.520><c> here</c><00:00:00.800><c> we</c><00:00:01.000><c> are</c>

00:00:02.000 --> 00:00:02.010 align:start position:0%
so here we are

00:00:02.010 --> 00:00:04.000 align:start position:0%
so here we are
in front of the elephants
`

describe('vttToText', () => {
  it('joins the lines of a caption file into plain text', () => {
    expect(vttToText(MANUAL)).toBe('All right, so here we are, in front of the elephants\nthe cool thing about these guys')
  })

  it('drops inline timing tags and the repeats of rolling auto captions', () => {
    expect(vttToText(ROLLING)).toBe('so here we are\nin front of the elephants')
  })

  it('keeps the start time of each cue on request', () => {
    expect(vttToText(MANUAL, true)).toBe('[00:01] All right, so here we are, in front of the elephants\n[00:05] the cool thing about these guys')
  })

  it('returns an empty string when there is no speech', () => {
    expect(vttToText('WEBVTT\n\n')).toBe('')
  })
})

describe('vttToText hardening', () => {
  it('turns HTML entities in captions back into characters', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nTom &amp; Jerry &gt;&gt; &quot;hi&quot; it&#39;s&nbsp;fine\n'
    expect(vttToText(vtt)).toBe('Tom & Jerry >> "hi" it\'s fine')
  })

  it('reads a caption made of 200,000 "<" in well under a second', () => {
    const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n${'<'.repeat(200_000)}\n`
    const t = Date.now()
    vttToText(vtt)
    expect(Date.now() - t).toBeLessThan(1000)
  })
})

describe('planTranscript', () => {
  it('asks yt-dlp for captions only, manual first and auto as a fallback, in the chosen languages', () => {
    const args = planTranscript('https://youtu.be/abc', { outputDir: '/tmp/x', langs: ['en', 'es'] })
    expect(args).toEqual(expect.arrayContaining(['--skip-download', '--write-subs', '--write-auto-subs', '--sub-format', 'vtt']))
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('en,es')
    expect(args).toContain('--no-playlist')
    expect(args.slice(-2)).toEqual(['--', 'https://youtu.be/abc'])
  })

  it('defaults to English', () => {
    expect(planTranscript('u', { outputDir: 'x' })[planTranscript('u', { outputDir: 'x' }).indexOf('--sub-langs') + 1]).toBe('en')
  })
})

describe('pickCaptionFile', () => {
  it('prefers the first requested language and ignores other files', () => {
    const files = ['a [id].es.vtt', 'a [id].en.vtt', 'a [id].info.json']
    expect(pickCaptionFile(files, ['en', 'es'])).toBe('a [id].en.vtt')
    expect(pickCaptionFile(files, ['fr'])).toBeUndefined()
    expect(pickCaptionFile(['a.en.vtt'], [])).toBe('a.en.vtt')
  })
})
