import { resolutionOptions, type CompressionLevel, type PerformanceLevel, type Resolution } from '@sparky/core'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// The demo pretends the visitor has a 4K clip and an NVIDIA card,
// so Max unlocks 1440p and 4K just like it would in the app.
const DEMO_GPU = { encoders: ['h264_nvenc', 'hevc_nvenc'] }

interface DemoState {
  level: PerformanceLevel
  setLevel: (l: PerformanceLevel) => void
  compression: CompressionLevel
  setCompression: (c: CompressionLevel) => void
  resolution: Resolution | null
  setResolution: (r: Resolution | null) => void
  options: ReturnType<typeof resolutionOptions>
  /** Resolution after the lock rules are applied. */
  effectiveResolution: Resolution | null
}

const Ctx = createContext<DemoState | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<PerformanceLevel>('max')
  const [compression, setCompression] = useState<CompressionLevel>(2)
  const [resolution, setResolution] = useState<Resolution | null>(2160)
  const value = useMemo(() => {
    const options = resolutionOptions({ sourceHeight: 2160, performance: level, gpu: DEMO_GPU, codec: 'h264' })
    const usable = options.find((o) => o.value === resolution && !o.locked)
    const effectiveResolution = resolution === null ? null : usable ? resolution : 1080
    return { level, setLevel, compression, setCompression, resolution, setResolution, options, effectiveResolution }
  }, [level, compression, resolution])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDemo() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDemo must be used inside DemoProvider')
  return v
}
