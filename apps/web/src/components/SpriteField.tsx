import { useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

/**
 * A field of glowing sprites. At `progress` 0 the dots trace the Sparky bolt like a small galaxy;
 * as progress rises they swirl out into a spiral star field. Drawn on a 2D canvas with
 * pre-rendered glow sprites, so thousands of dots stay cheap.
 */

// The bolt from the logo, in its 24×24 icon space.
const BOLT: [number, number][] = [
  [13, 2],
  [3, 14],
  [12, 14],
  [11, 22],
  [21, 10],
  [12, 10],
  [13, 2],
]

const PALETTE = [
  { rgb: '237,237,237', weight: 0.62 },
  { rgb: '143,184,255', weight: 0.16 },
  { rgb: '139,124,246', weight: 0.11 },
  { rgb: '255,209,102', weight: 0.07 },
  { rgb: '255,122,69', weight: 0.04 },
]

interface Particle {
  /** Home on the bolt, in bolt units (0–24). */
  bx: number
  by: number
  /** Spiral position: radius (0–1 of the field) and angle. */
  r: number
  a: number
  size: number
  sprite: number
  phase: number
  speed: number
  /** Staggers the scatter so it ripples outwards. */
  delay: number
  /** Background stars never join the bolt. */
  star: boolean
}

function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function pickSprite(): number {
  let x = Math.random()
  for (let i = 0; i < PALETTE.length; i++) {
    x -= PALETTE[i]!.weight
    if (x <= 0) return i
  }
  return 0
}

/** Points spread evenly along the bolt outline, with a soft glow band and a sprinkle inside. */
function sampleBolt(count: number): [number, number][] {
  const segs = BOLT.slice(0, -1).map((p, i) => {
    const q = BOLT[i + 1]!
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }
  })
  const total = segs.reduce((s, x) => s + x.len, 0)
  const out: [number, number][] = []
  const outline = Math.round(count * 0.86)
  for (let i = 0; i < outline; i++) {
    let d = Math.random() * total
    const seg = segs.find((s) => (d -= s.len) <= 0) ?? segs[segs.length - 1]!
    const t = Math.random()
    const dx = seg.q[0] - seg.p[0]
    const dy = seg.q[1] - seg.p[1]
    const nx = -dy / seg.len
    const ny = dx / seg.len
    const spread = gauss() * 0.28
    out.push([seg.p[0] + dx * t + nx * spread, seg.p[1] + dy * t + ny * spread])
  }
  // A faint dusting inside the bolt, like the core of a galaxy.
  const inside = (x: number, y: number) => {
    let hit = false
    for (let i = 0, j = BOLT.length - 2; i < BOLT.length - 1; j = i++) {
      const [xi, yi] = BOLT[i]!
      const [xj, yj] = BOLT[j]!
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  while (out.length < count) {
    const x = 3 + Math.random() * 18
    const y = 2 + Math.random() * 20
    if (inside(x, y)) out.push([x, y])
  }
  return out
}

function makeSprites(): HTMLCanvasElement[] {
  return PALETTE.map(({ rgb }) => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, `rgba(${rgb},1)`)
    grad.addColorStop(0.18, `rgba(${rgb},0.85)`)
    grad.addColorStop(0.42, `rgba(${rgb},0.22)`)
    grad.addColorStop(1, `rgba(${rgb},0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    return c
  })
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

export interface SpriteFieldProps {
  /** 0 = bolt, 1 = fully scattered galaxy. Read every frame. */
  getProgress: () => number
  /** Bolt height as a fraction of the canvas height. */
  boltScale?: number
  /** Vertical centre of the bolt, 0–1. */
  boltY?: number
  /** Gather the dots into the bolt when the field first appears. */
  assembleOnMount?: boolean
  className?: string
}

export function SpriteField({ getProgress, boltScale = 0.62, boltY = 0.46, assembleOnMount = true, className }: SpriteFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const progressRef = useRef(getProgress)
  progressRef.current = getProgress

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sprites = makeSprites()
    let particles: Particle[] = []
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let visible = true
    const born = performance.now()

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const area = (w * h) / (1440 * 900)
      const boltCount = Math.round(Math.max(900, Math.min(2600, 2200 * Math.sqrt(area))))
      const starCount = Math.round(Math.max(160, Math.min(700, 520 * area)))
      const homes = sampleBolt(boltCount)
      particles = homes.map(([bx, by], i) => {
        // Three spiral arms; the scatter keeps a hint of the galaxy.
        const arm = i % 3
        const r = Math.pow(Math.random(), 0.55)
        return {
          bx,
          by,
          r,
          a: arm * ((Math.PI * 2) / 3) + r * 5.2 + gauss() * 0.35,
          size: 0.7 + Math.pow(Math.random(), 3) * 2.6,
          sprite: pickSprite(),
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 1.8,
          delay: Math.random() * 0.35,
          star: false,
        }
      })
      for (let i = 0; i < starCount; i++) {
        particles.push({ bx: 0, by: 0, r: Math.sqrt(Math.random()) * 1.15, a: Math.random() * Math.PI * 2, size: 0.4 + Math.random() * 1.1, sprite: Math.random() < 0.8 ? 0 : pickSprite(), phase: Math.random() * 6.28, speed: 0.3 + Math.random(), delay: 0, star: true })
      }
    }

    const draw = (now: number) => {
      const t = (now - born) / 1000
      // On load the dots fly in from the galaxy to form the bolt.
      const intro = reduce || !assembleOnMount ? 1 : clamp01((t - 0.15) / 1.9)
      const scroll = clamp01(progressRef.current())
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      const unit = (h * boltScale) / 20
      const ox = w / 2 - 12 * unit
      const oy = h * boltY - 12 * unit
      const cx = w / 2
      const cy = h * boltY
      const radius = Math.hypot(w, h) * 0.62
      const swirl = t * 0.03 + scroll * 1.6

      for (const p of particles) {
        const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * p.speed + p.phase)
        const angle = p.a + swirl * (1.2 - p.r * 0.6)
        const gx = cx + Math.cos(angle) * p.r * radius
        // Flatten the galaxy a little so it reads as a disc.
        const gy = cy + Math.sin(angle) * p.r * radius * 0.62
        let x: number
        let y: number
        let alpha: number
        if (p.star) {
          x = gx
          y = gy - scroll * 60 * p.size
          alpha = tw * (0.25 + scroll * 0.45)
        } else {
          const bx = ox + p.bx * unit
          const by = oy + p.by * unit
          // 1 = on the bolt, 0 = out in the galaxy.
          const form = ease(clamp01((intro - p.delay * 0.6) / (1 - p.delay * 0.6))) * (1 - ease(clamp01((scroll - p.delay * 0.4) / 0.75)))
          x = gx + (bx - gx) * form
          y = gy + (by - gy) * form
          alpha = tw * (0.35 + form * 0.65)
        }
        const s = p.size * (p.star ? 3 : 4.2)
        ctx.globalAlpha = alpha
        ctx.drawImage(sprites[p.sprite]!, x - s / 2, y - s / 2, s, s)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const loop = (now: number) => {
      draw(now)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    }

    build()
    const ro = new ResizeObserver(() => {
      build()
      if (reduce) draw(performance.now())
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting) && !document.hidden
      cancelAnimationFrame(raf)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    })
    io.observe(canvas)
    const onVis = () => {
      visible = !document.hidden
      cancelAnimationFrame(raf)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVis)
    // Reduced motion: one still frame of the finished bolt, redrawn on scroll.
    const onScroll = () => reduce && draw(performance.now())
    if (reduce) {
      draw(performance.now())
      window.addEventListener('scroll', onScroll, { passive: true })
    } else raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('scroll', onScroll)
    }
  }, [reduce, boltScale, boltY, assembleOnMount])

  return <canvas ref={ref} aria-hidden className={className} />
}
