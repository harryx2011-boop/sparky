// The media ops end to end with the real FFmpeg. Point SPARKY_TEST_BIN at a folder with ffmpeg and ffprobe; without it these skip.
import { MEDIA_TEXT, type Job } from '@sparky/core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createEngine, OpInputError, type Engine } from '../../src'
import { run } from '../../src/process'

const BIN = process.env.SPARKY_TEST_BIN
// A skip must never pass for green in CI.
if (process.env.CI && !BIN) throw new Error('Set SPARKY_TEST_BIN in CI so the real-tool tests run.')

interface Stream {
  codec_type: string
  width?: number
  height?: number
  r_frame_rate?: string
}

describe.skipIf(!BIN)('media ops with real FFmpeg', () => {
  let dir: string
  let engine: Engine
  const src = (name: string) => path.join(dir, name)

  const ffprobe = async (file: string) => {
    const res = await run(path.join(BIN!, 'ffprobe'), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
    const data = JSON.parse(res.stdout) as { format: { duration: string }; streams: Stream[] }
    const video = data.streams.find((s) => s.codec_type === 'video')
    return { duration: Number(data.format.duration), video, audio: data.streams.some((s) => s.codec_type === 'audio') }
  }

  const one = async (op: string, args: Record<string, unknown>): Promise<Job> => {
    const [job] = await engine.runOp(op, args)
    return job!
  }

  const done = async (op: string, args: Record<string, unknown>): Promise<Job> => {
    const job = await one(op, args)
    expect(job.error).toBeUndefined()
    expect(job.status).toBe('done')
    expect(fs.existsSync(job.outputs[0]!)).toBe(true)
    return job
  }

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-media-'))
    engine = await createEngine({
      binDirs: [BIN!],
      dataDir: path.join(dir, 'data'),
      tempDir: path.join(dir, 'tmp'),
      defaultRoot: path.join(dir, 'Sparky'),
      appVersion: 'test',
      skipGpu: true,
      host: {},
    })
    engine.setSettings({ batch: true, performance: 'normal' })
    const ffmpeg = path.join(BIN!, 'ffmpeg')
    const tone = (d: number) => ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${d}`]
    const pic = (d: number) => ['-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=30:duration=${d}`]
    // A 3-second 720p clip with a tone, the same clip as MP4, a 12-second one for sizes and cancel, and a sound file.
    await run(ffmpeg, ['-y', ...pic(3), ...tone(3), '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', src('clip.mov')])
    await run(ffmpeg, ['-y', ...pic(3), ...tone(3), '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', src('clip.mp4')])
    await run(ffmpeg, ['-y', ...pic(12), ...tone(12), '-c:v', 'libx264', '-crf', '12', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', src('long.mp4')])
    await run(ffmpeg, ['-y', ...tone(2), src('tone.wav')])
    await run(ffmpeg, ['-y', ...tone(2), '-b:a', '32k', src('thin.mp3')])
  }, 120_000)

  afterAll(async () => {
    await engine?.shutdown()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  describe('media.edit', () => {
    it('trims to the asked stretch, keeping the format and marking the name', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], trimStart: 0.5, trimEnd: 2 })
      expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'clip (edited).mov'))
      expect((await ffprobe(job.outputs[0]!)).duration).toBeCloseTo(1.5, 0)
      expect(job.sizeBefore).toBeGreaterThan(0)
      expect(job.sizeAfter).toBeGreaterThan(0)
    })

    it('crops, then turns a quarter, so the sides swap', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], cropX: 100, cropY: 50, cropWidth: 640, cropHeight: 360, rotate: 90, output: 'mp4' })
      expect((await ffprobe(job.outputs[0]!)).video).toMatchObject({ width: 360, height: 640 })
    })

    it('resizes keeping the shape, and sets the frame rate', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], height: 360, fps: 15, flip: 'hv', output: 'webm' })
      const p = await ffprobe(job.outputs[0]!)
      expect(p.video).toMatchObject({ width: 640, height: 360, r_frame_rate: '15/1' })
    })

    it('strips the sound', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], stripAudio: true, output: 'mp4' })
      const p = await ffprobe(job.outputs[0]!)
      expect(p.audio).toBe(false)
      expect(p.video).toBeDefined()
    })

    it('reverses, fades and speeds up a video and its sound together', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], reverse: true, fadeIn: 0.5, fadeOut: 0.5, speed: 2, volume: 150, output: 'mp4' })
      const p = await ffprobe(job.outputs[0]!)
      expect(p.duration).toBeCloseTo(1.5, 0)
      expect(p.audio).toBe(true)
    })

    it('edits a sound file with the sound fields and skips the picture ones', async () => {
      const job = await done('media.edit', { files: [src('tone.wav')], speed: 2, volume: 50, fadeIn: 0.2, reverse: true, rotate: 90 })
      expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Audio', 'tone (edited).wav'))
      const p = await ffprobe(job.outputs[0]!)
      expect(p.duration).toBeCloseTo(1, 0)
      expect(p.video).toBeUndefined()
      expect(job.note).toBe(MEDIA_TEXT.videoOnlySkipped)
    })

    it('saves the sound of a video as MP3', async () => {
      const job = await done('media.edit', { files: [src('clip.mov')], output: 'mp3', trimEnd: 1 })
      const p = await ffprobe(job.outputs[0]!)
      expect(p.video).toBeUndefined()
      expect(p.duration).toBeCloseTo(1, 0)
    })

    it('reports progress as a fraction of the length', async () => {
      const seen: number[] = []
      const onChange = (jobs: Job[]) => jobs.forEach((j) => j.op === 'media.edit' && j.status === 'running' && seen.push(j.progress))
      engine.on('change', onChange)
      await done('media.edit', { files: [src('long.mp4')], width: 640, performance: 'low' })
      engine.off('change', onChange)
      expect(seen.some((p) => p > 0 && p < 1)).toBe(true)
    })

    it('says plainly what is wrong', async () => {
      expect((await one('media.edit', { files: [src('tone.wav')], output: 'mp4' })).error).toBe(MEDIA_TEXT.audioToVideo)
      expect((await one('media.edit', { files: [src('clip.mov')], cropX: 1000, cropWidth: 640 })).error).toBe(MEDIA_TEXT.cropOutside(1280, 720))
      expect((await one('media.edit', { files: [src('clip.mov')], trimStart: 2, trimEnd: 1 })).error).toBe(MEDIA_TEXT.trimBackwards)
      expect(() => engine.startOp('media.edit', { files: [src('clip.mov')], rotate: 45 })).toThrow(OpInputError)
    })
  })

  describe('media.compress', () => {
    it('lands a size in MB with two passes and reports both sizes', async () => {
      const job = await done('media.compress', { files: [src('long.mp4')], targetMb: 0.5 })
      expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'long (smaller).mp4'))
      const size = fs.statSync(job.outputs[0]!).size
      expect(size).toBeLessThanOrEqual(0.5 * 1024 * 1024 * 1.05)
      expect(size).toBeGreaterThan(0.5 * 1024 * 1024 * 0.5)
      expect(job.sizeBefore).toBe(fs.statSync(src('long.mp4')).size)
      expect(job.sizeAfter).toBe(size)
      expect(fs.readdirSync(path.join(dir, 'tmp', String(process.pid))).filter((f) => f.startsWith('compress-'))).toEqual([])
    })

    it('keeps the original when it is already under the preset size', async () => {
      const job = await done('media.compress', { files: [src('clip.mp4')], target: 'discord' })
      expect(job.outputs[0]).toBe(src('clip.mp4'))
      expect(job.note).toBe(MEDIA_TEXT.alreadyUnder('10'))
    })

    it('still saves a copy at out when the source is already under the size', async () => {
      const job = await done('media.compress', { files: [src('clip.mp4')], target: 'discord', out: path.join(dir, 'under') + path.sep })
      expect(job.outputs[0]).toBe(path.join(dir, 'under', 'clip (smaller).mp4'))
      expect(fs.statSync(job.outputs[0]!).size).toBe(fs.statSync(src('clip.mp4')).size)
      expect(job.note).toBe(MEDIA_TEXT.alreadyUnder('10'))
    })

    it('drops a same-format result that came out bigger, pointing at the original or copying it to out', async () => {
      const kept = await done('media.compress', { files: [src('thin.mp3')], target: 'archive' })
      expect(kept.outputs[0]).toBe(src('thin.mp3'))
      expect(kept.note).toBe(MEDIA_TEXT.alreadySmall)
      const copied = await done('media.compress', { files: [src('thin.mp3')], target: 'archive', out: path.join(dir, 'bigger') + path.sep })
      expect(copied.outputs[0]).toBe(path.join(dir, 'bigger', 'thin (smaller).mp3'))
      expect(fs.statSync(copied.outputs[0]!).size).toBe(fs.statSync(src('thin.mp3')).size)
      expect(copied.sizeAfter).toBe(copied.sizeBefore)
      expect(copied.note).toBe(MEDIA_TEXT.alreadySmall)
    })

    it('makes a sound file smaller as MP3 by default', async () => {
      const job = await done('media.compress', { files: [src('tone.wav')], target: 'web' })
      expect(job.outputs[0]).toMatch(/Audio[\\/]tone \(smaller\)\.mp3$/)
      expect(job.sizeAfter!).toBeLessThan(job.sizeBefore!)
    })

    it('cancels mid-way and leaves nothing behind', async () => {
      const ac = new AbortController()
      const onChange = (jobs: Job[]) => jobs.forEach((j) => j.op === 'media.compress' && j.status === 'running' && j.progress > 0.05 && ac.abort())
      engine.on('change', onChange)
      const [job] = await engine.runOp('media.compress', { files: [src('long.mp4')], targetMb: 1, out: path.join(dir, 'canceled') + path.sep }, { signal: ac.signal })
      engine.off('change', onChange)
      expect(job!.status).toBe('canceled')
      expect(fs.readdirSync(path.join(dir, 'canceled'))).toEqual([])
    })
  })

  describe('media.thumbs', () => {
    it('takes a poster frame at the video’s own width', async () => {
      const job = await done('media.thumbs', { files: [src('clip.mov')] })
      expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Images', 'clip (poster).png'))
      expect(await sharp(fs.readFileSync(job.outputs[0]!)).metadata()).toMatchObject({ width: 1280, height: 720 })
    })

    it('lays a sprite sheet out as a grid of the asked frames', async () => {
      const job = await done('media.thumbs', { files: [src('clip.mov')], mode: 'sprite', count: 6, columns: 3, width: 160 })
      expect(await sharp(fs.readFileSync(job.outputs[0]!)).metadata()).toMatchObject({ width: 3 * 160, height: 2 * 90 })
    })

    it('makes an animated WebP preview', async () => {
      const job = await done('media.thumbs', { files: [src('clip.mov')], mode: 'preview', at: 0, durationSec: 1, fps: 10, width: 320 })
      expect(job.outputs[0]).toMatch(/clip \(preview\)\.webp$/)
      const meta = await sharp(fs.readFileSync(job.outputs[0]!), { animated: true }).metadata()
      expect(meta.width).toBe(320)
      expect(meta.pages).toBeGreaterThanOrEqual(9)
    })

    it('says a sound file has no picture, and refuses a too-narrow width before queueing', async () => {
      expect((await one('media.thumbs', { files: [src('tone.wav')] })).error).toBe(MEDIA_TEXT.noPicture)
      expect(() => engine.startOp('media.thumbs', { files: [src('clip.mov')], width: 8 })).toThrow(OpInputError)
    })
  })

  describe('media.gif', () => {
    it('turns a trimmed stretch into a looping GIF at the asked size and rate', async () => {
      const job = await done('media.gif', { files: [src('clip.mov')], fps: 10, width: 320, trimStart: 0.5, trimEnd: 1.5, dither: 'bayer' })
      expect(job.outputs[0]).toBe(path.join(dir, 'Sparky', 'Video', 'clip.gif'))
      const meta = await sharp(fs.readFileSync(job.outputs[0]!), { animated: true }).metadata()
      expect(meta.width).toBe(320)
      expect(meta.pages).toBeGreaterThanOrEqual(9)
      expect(meta.pages).toBeLessThanOrEqual(11)
      expect(meta.loop).toBe(0)
    })

    it('plays once when loop is off', async () => {
      const job = await done('media.gif', { files: [src('clip.mov')], loop: false, trimEnd: 0.5, width: 160, out: path.join(dir, 'once.gif') })
      expect(job.outputs[0]).toBe(path.join(dir, 'once.gif'))
      expect((await sharp(fs.readFileSync(job.outputs[0]!), { animated: true }).metadata()).loop).not.toBe(0)
    })
  })
})
