import { CONTACT, LogoMark } from '@sparky/ui'
import { Download } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useMemo, useRef } from 'react'
import { ButtonLink, Sparks } from '../components/ui'

/** Sparks that fly out from the logo once, when the section comes into view. */
function Burst({ play }: { play: boolean }) {
  const reduce = useReducedMotion()
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2 + (i % 2 ? 0.08 : -0.05)
        const dist = 110 + ((i * 37) % 120)
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 2 + (i % 3), delay: (i % 5) * 0.03 }
      }),
    [],
  )
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-foreground"
          style={{ width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={play ? { x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.4, 1.3, 0.6] } : undefined}
          transition={{ duration: 1.3, delay: 0.15 + p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

export function Get() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  return (
    <section id="get" className="relative overflow-hidden border-t border-[#161616] px-4 py-32 sm:px-6 lg:py-40">
      <div aria-hidden className="glow absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2" />
      <Sparks count={6} />
      <div className="relative mx-auto flex max-w-[720px] flex-col items-center gap-7 text-center">
        <div ref={ref} className="relative">
          <Burst play={inView} />
          <motion.div
            initial={{ scale: 0.8, rotate: -8 }}
            animate={inView ? { scale: 1, rotate: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <LogoMark size={72} />
          </motion.div>
        </div>
        <h2 className="text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[64px]">Give your files a spark.</h2>
        <p className="text-lg text-muted-foreground">Free for Windows 10 and 11. Open source, so anyone can see how it works.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={CONTACT.installer} variant="primary" size="lg">
            <Download size={17} />
            Download for Windows
          </ButtonLink>
          <ButtonLink href={CONTACT.github} size="lg">
            View the code
          </ButtonLink>
        </div>
        <span className="font-mono text-xs text-subtle-foreground">64-bit installer · no account needed</span>
      </div>
    </section>
  )
}
