import { Slider } from 'radix-ui'
import type { CSSProperties } from 'react'

/** Fixed, not random, so the sparks never jump between renders. x/y in % of the track, t = cycle in seconds. */
const SPARKS = [
  { x: 6, y: 34, size: 2, t: 9, delay: -1.2, dx: 46, peak: 0.6 },
  { x: 14, y: 66, size: 3, t: 12, delay: -7.5, dx: 38, peak: 0.5 },
  { x: 25, y: 44, size: 2, t: 7, delay: -3.1, dx: 52, peak: 0.6 },
  { x: 37, y: 72, size: 3, t: 11, delay: -5.6, dx: 34, peak: 0.45 },
  { x: 48, y: 30, size: 3, t: 14, delay: -9.8, dx: 44, peak: 0.55 },
  { x: 59, y: 58, size: 2, t: 8, delay: -2.4, dx: 50, peak: 0.6 },
  { x: 71, y: 40, size: 4, t: 13, delay: -6.3, dx: 30, peak: 0.4 },
  { x: 83, y: 64, size: 3, t: 10, delay: -4.7, dx: 42, peak: 0.6 },
] as const

/** The pill track and its lime fill; the fill carries a slow sheen and drifting sparks, both clipped to it. */
export function FlowingTrack() {
  return (
    <Slider.Track className="sp-flow-track">
      <Slider.Range className="sp-flow-range">
        <span className="sp-flow-layer" aria-hidden>
          <span className="sp-flow-sheen" />
          <span className="sp-flow-sheen" data-slow="" />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="sp-flow-spark"
              style={
                {
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.size,
                  height: s.size,
                  animationDuration: `${s.t}s`,
                  animationDelay: `${s.delay}s`,
                  '--sp-flow-dx': `${s.dx}px`,
                  '--sp-flow-peak': s.peak,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </Slider.Range>
    </Slider.Track>
  )
}
