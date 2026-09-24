import { describe, expect, it } from 'vitest'
import { clampResolution, describeGpu, gpuEncoderFor, NO_GPU, parseEncoderList, resolutionOptions } from '../src'

const ENCODERS = `Encoders:
 V..... = Video
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D h264_amf             AMD AMF H.264 Encoder (codec h264)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V....D hevc_nvenc           NVIDIA NVENC hevc encoder (codec hevc)
 A....D aac                  AAC (Advanced Audio Coding)
`

describe('gpu', () => {
  it('reads hardware encoders from ffmpeg -encoders', () => {
    expect(parseEncoderList(ENCODERS)).toEqual(['h264_amf', 'h264_nvenc', 'hevc_nvenc'])
  })

  it('prefers NVIDIA, then AMD, then Intel', () => {
    const gpu = { encoders: ['h264_amf', 'h264_nvenc'] }
    expect(gpuEncoderFor(gpu, 'h264')).toEqual({ vendor: 'nvidia', encoder: 'h264_nvenc' })
    expect(gpuEncoderFor(gpu, 'av1')).toBeUndefined()
    expect(describeGpu(gpu)).toBe('NVIDIA + AMD graphics card')
    expect(describeGpu(NO_GPU)).toMatch(/No supported/)
  })
})

describe('1440p and 4K unlock rules', () => {
  const gpu = { encoders: ['h264_nvenc'] }

  it('unlocks everything when source, Max and GPU all allow it', () => {
    const opts = resolutionOptions({ sourceHeight: 2160, performance: 'max', gpu, codec: 'h264' })
    expect(opts.every((o) => !o.locked && !o.hidden)).toBe(true)
  })

  it('locks 1440p and 4K unless Performance is Max', () => {
    const opts = resolutionOptions({ sourceHeight: 2160, performance: 'normal', gpu, codec: 'h264' })
    expect(opts.filter((o) => o.locked).map((o) => o.label)).toEqual(['1440p', '4K'])
    expect(opts[3]!.reason).toMatch(/Max/)
  })

  it('names the missing encoder when there is no GPU for the codec', () => {
    const opts = resolutionOptions({ sourceHeight: 2160, performance: 'max', gpu, codec: 'hevc' })
    expect(opts[3]!.locked).toBe(true)
    expect(opts[3]!.reason).toMatch(/hevc_nvenc/)
  })

  it('hides anything taller than the source, so it never upscales', () => {
    const opts = resolutionOptions({ sourceHeight: 1080, performance: 'max', gpu, codec: 'h264' })
    expect(opts.filter((o) => o.hidden).map((o) => o.label)).toEqual(['1440p', '4K'])
  })

  it('clamps a wanted resolution down to the best available', () => {
    const opts = resolutionOptions({ sourceHeight: 2160, performance: 'normal', gpu, codec: 'h264' })
    expect(clampResolution(2160, opts)).toBe(1080)
    expect(clampResolution(720, opts)).toBe(720)
    expect(clampResolution(null, opts)).toBeNull()
  })
})
