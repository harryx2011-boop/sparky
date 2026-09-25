// A faint marker grid under the whole site, ported from Helix's ambient background.
// Fixed behind everything, monochrome, and quiet: it pauses while the tab is hidden and holds still for reduced motion.
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : document.visibilityState === 'visible'))
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

type Marker = '·' | '▪' | '+' | '▫'
const MARKERS: Marker[] = ['·', '▪', '+', '▫']
const CELL = 56
const TICK_MS = 700
const BURST_INTERVAL_MS = 6000
const BURST_MS = 900
const MAX_MARKERS = 480

interface Cell {
  c: number
  r: number
  m: Marker
}

export function GridCells({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cells, setCells] = useState<Cell[]>([])
  const [burstRow, setBurstRow] = useState<number | null>(null)
  const rngRef = useRef(mulberry32(11))

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const cols = Math.max(1, Math.ceil(size.w / CELL))
  const rows = Math.max(1, Math.ceil(size.h / CELL))

  const density = useMemo(() => {
    const total = cols * rows
    const target = size.w > 1440 ? Math.floor(total * 0.12) : Math.floor(total * 0.18)
    return Math.min(MAX_MARKERS, Math.max(24, target))
  }, [cols, rows, size.w])

  useEffect(() => {
    if (!size.w) return
    const rng = mulberry32(11)
    rngRef.current = rng
    const initial: Cell[] = []
    for (let i = 0; i < density; i++) {
      initial.push({ c: Math.floor(rng() * cols), r: Math.floor(rng() * rows), m: MARKERS[Math.floor(rng() * MARKERS.length)]! })
    }
    setCells(initial)
  }, [size.w, cols, rows, density])

  const running = visible && !reduced && size.w > 0

  useEffect(() => {
    if (!running) return
    const rng = rngRef.current
    const id = window.setInterval(() => {
      setCells((prev) => {
        if (!prev.length) return prev
        const next = prev.slice()
        const flips = Math.max(1, Math.floor(next.length * 0.03))
        for (let i = 0; i < flips; i++) {
          const idx = Math.floor(rng() * next.length)
          next[idx] = { c: Math.floor(rng() * cols), r: Math.floor(rng() * rows), m: MARKERS[Math.floor(rng() * MARKERS.length)]! }
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running, cols, rows])

  useEffect(() => {
    if (!running) return
    let clearId: number | undefined
    const id = window.setInterval(() => {
      setBurstRow(Math.floor(rngRef.current() * rows))
      clearId = window.setTimeout(() => setBurstRow(null), BURST_MS)
    }, BURST_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      if (clearId) window.clearTimeout(clearId)
    }
  }, [running, rows])

  const shown = reduced ? cells.slice(0, Math.min(cells.length, 60)) : cells

  return (
    <div
      aria-hidden="true"
      className={['pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden text-foreground', className].filter(Boolean).join(' ')}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: `${CELL}px ${CELL}px`,
          opacity: 0.03,
        }}
      />
      {shown.map((cell, i) => {
        const inBurst = burstRow !== null && cell.r === burstRow
        return (
          <span
            key={i}
            className="absolute font-mono text-[11px] leading-none"
            style={{
              left: cell.c * CELL + CELL / 2,
              top: cell.r * CELL + CELL / 2,
              transform: 'translate(-50%, -50%)',
              opacity: inBurst ? 0.5 : 0.13,
              transition: reduced ? undefined : 'opacity 0.4s ease-out',
            }}
          >
            {inBurst ? '▪' : cell.m}
          </span>
        )
      })}
    </div>
  )
}
