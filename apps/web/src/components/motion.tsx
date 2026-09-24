// Reusable motion pieces that make the page feel alive. All of them calm down for reduced motion.
import { cn } from '@sparky/ui'
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

/** Words rise and un-blur one after another. Animates on mount, or when scrolled into view. */
export function SplitText({ text, delay = 0, inView = false, className, stagger = 0.06 }: { text: string; delay?: number; inView?: boolean; className?: string; stagger?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const go = inView ? seen : true
  const words = text.split(' ')
  return (
    <span ref={ref} className={cn('inline', className)} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { y: '105%', opacity: 0, filter: 'blur(8px)' }}
            animate={go ? { y: '0%', opacity: 1, filter: 'blur(0px)' } : undefined}
            transition={{ duration: 0.85, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

/** Pulls its child a little towards the pointer. */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion()
  const x = useSpring(0, { stiffness: 260, damping: 18, mass: 0.4 })
  const y = useSpring(0, { stiffness: 260, damping: 18, mass: 0.4 })
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  return (
    <motion.span
      className={cn('inline-block', className)}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.span>
  )
}

/** A card that tilts a few degrees towards the pointer. */
export function TiltCard({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion()
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 200, damping: 20 })
  return (
    <motion.div
      className={cn('relative [transform-style:preserve-3d]', className)}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width)
        my.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => {
        mx.set(0.5)
        my.set(0.5)
      }}
    >
      {children}
    </motion.div>
  )
}

/** Thin bar along the top that fills as you scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.3 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-[linear-gradient(90deg,#8fb8ff,#8b7cf6,#ff7a45,#ffd166)]"
      style={{ scaleX }}
    />
  )
}

/** An endless ticker. Speeds up a little while you scroll. */
export function Marquee({ items, className, duration = 40, reverse = false }: { items: ReactNode[]; className?: string; duration?: number; reverse?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]', className)}>
      {[0, 1].map((copy) => (
        <motion.div
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 items-center gap-10 pr-10"
          animate={reduce ? undefined : { x: reverse ? ['-100%', '0%'] : ['0%', '-100%'] }}
          transition={{ duration, ease: 'linear', repeat: Infinity }}
        >
          {items.map((it, i) => (
            <span key={i} className="shrink-0">
              {it}
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

/** Counts up to a number when it scrolls into view. */
export function CountUp({ to, format = (n) => Math.round(n).toString(), duration = 1.4, className }: { to: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [value, setValue] = useState(reduce ? to : 0)
  useEffect(() => {
    if (!inView || reduce) return
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setValue })
    return () => c.stop()
  }, [inView, reduce, to, duration])
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
