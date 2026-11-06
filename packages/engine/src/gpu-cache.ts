// GPU encoder probe cached by the ffmpeg file (path, size, mtime): a warm start reads it, a background probe refreshes it.
import { describeGpu, type GpuInfo } from '@sparky/core'
import fs from 'node:fs'

type Gpu = GpuInfo & { label: string }

function stamp(ffmpeg: string): string | null {
  try {
    const s = fs.statSync(ffmpeg)
    return `${ffmpeg}|${s.size}|${s.mtimeMs}`
  } catch {
    return null
  }
}

function read(cacheFile: string, key: string): string[] | null {
  try {
    const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { key?: unknown; encoders?: unknown }
    return saved.key === key && Array.isArray(saved.encoders) ? (saved.encoders as string[]) : null
  } catch {
    return null
  }
}

export async function loadGpu(ffmpeg: string | undefined, cacheFile: string, detect: (ffmpeg: string | undefined) => Promise<Gpu>): Promise<Gpu> {
  const key = ffmpeg ? stamp(ffmpeg) : null
  const probe = detect(ffmpeg).then(async (gpu) => {
    if (key) await fs.promises.writeFile(cacheFile, JSON.stringify({ key, encoders: gpu.encoders })).catch(() => undefined)
    return gpu
  })
  const hit = key ? read(cacheFile, key) : null
  if (!hit) return probe
  probe.catch(() => undefined)
  return { encoders: hit, label: describeGpu({ encoders: hit }) }
}
