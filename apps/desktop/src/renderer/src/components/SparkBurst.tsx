import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Burst {
  id: number
}

/** A short spark burst above the dock whenever a job finishes successfully. */
export function SparkBurst() {
  const reduce = useReducedMotion()
  const [bursts, setBursts] = useState<Burst[]>([])
  useEffect(
    () =>
      api.queue.onFinished((job) => {
        if (job.status !== 'done' || reduce) return
        const id = Date.now() + Math.random()
        setBursts((b) => [...b, { id }])
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100)
      }),
    [reduce],
  )
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-[calc(var(--dock-h,168px)+40px)] right-10 z-40">
      {bursts.map((b) => (
        <div key={b.id} className="absolute">
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2
            const d = 28 + (i % 3) * 12
            return (
              <motion.span
                key={i}
                className="absolute size-[3px] rounded-full bg-foreground"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
