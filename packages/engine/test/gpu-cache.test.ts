// The GPU encoder probe is cached by the ffmpeg file it ran against, so a warm start skips it (S33).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGpu } from '../src/gpu-cache'

let dir: string
let ffmpeg: string
let cache: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparky-gpu-'))
  ffmpeg = path.join(dir, 'ffmpeg.exe')
  cache = path.join(dir, 'gpu-cache.json')
  fs.writeFileSync(ffmpeg, 'v1')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const found = (encoders: string[]) => vi.fn(async () => ({ encoders, label: encoders.join(',') }))
const never = () => vi.fn(() => new Promise<never>(() => undefined))

describe('loadGpu', () => {
  it('probes on a cold start and saves the result', async () => {
    const detect = found(['h264_nvenc'])
    expect((await loadGpu(ffmpeg, cache, detect)).encoders).toEqual(['h264_nvenc'])
    expect(detect).toHaveBeenCalledWith(ffmpeg)
    expect(JSON.parse(fs.readFileSync(cache, 'utf8')).encoders).toEqual(['h264_nvenc'])
  })

  it('S33: Window first: a warm start answers from the cache without waiting for the probe', async () => {
    await loadGpu(ffmpeg, cache, found(['h264_nvenc']))
    const slow = never()
    const gpu = await loadGpu(ffmpeg, cache, slow)
    expect(gpu.encoders).toEqual(['h264_nvenc'])
    expect(gpu.label).toMatch(/\S/)
    expect(slow).toHaveBeenCalledOnce()
  })

  it('refreshes the cache in the background for the next start', async () => {
    await loadGpu(ffmpeg, cache, found(['h264_nvenc']))
    const driverGone = found([])
    expect((await loadGpu(ffmpeg, cache, driverGone)).encoders).toEqual(['h264_nvenc'])
    await vi.waitFor(() => expect(JSON.parse(fs.readFileSync(cache, 'utf8')).encoders).toEqual([]))
  })

  it('probes again when ffmpeg changes', async () => {
    await loadGpu(ffmpeg, cache, found(['h264_nvenc']))
    fs.writeFileSync(ffmpeg, 'v2 is longer')
    const detect = found(['h264_qsv'])
    expect((await loadGpu(ffmpeg, cache, detect)).encoders).toEqual(['h264_qsv'])
  })

  it('probes without caching when ffmpeg is missing', async () => {
    const detect = found([])
    expect((await loadGpu(undefined, cache, detect)).encoders).toEqual([])
    expect(fs.existsSync(cache)).toBe(false)
  })

  it('ignores a broken cache file', async () => {
    fs.writeFileSync(cache, '{not json')
    expect((await loadGpu(ffmpeg, cache, found(['h264_amf']))).encoders).toEqual(['h264_amf'])
  })
})
