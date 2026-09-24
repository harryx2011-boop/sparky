import { CONTACT, LogoMark } from '@sparky/ui'
import { Download } from 'lucide-react'
import { motion, useInView, useReducedMotion, useScroll } from 'motion/react'
import { useCallback, useMemo, useRef } from 'react'
import { Magnetic, SplitText } from '../components/motion'
import { SpriteField } from '../components/SpriteField'
import { ButtonLink } from '../components/ui'

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
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  // The galaxy from the top of the page gathers back into the bolt as you arrive.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'center center'] })
  const getProgress = useCallback(() => 1 - scrollYProgress.get(), [scrollYProgress])
  return (
    <section ref={sectionRef} id="get" className="relative overflow-hidden border-t border-[#161616] px-4 py-32 sm:px-6 lg:py-44">
      <SpriteField getProgress={getProgress} assembleOnMount={false} boltScale={0.8} boltY={0.5} className="absolute inset-0 size-full opacity-70" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_50%_50%,rgba(10,10,10,.75),transparent_75%)]" />
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
        <h2 className="text-balance text-[44px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[72px]">
          <SplitText text="Give your files a spark." inView />
        </h2>
        <p className="text-lg text-muted-foreground">Free for Windows 10 and 11. Open source, so anyone can see how it works.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Magnetic>
            <ButtonLink href={CONTACT.installer} variant="primary" size="lg">
              <Download size={17} />
              Download for Windows
            </ButtonLink>
          </Magnetic>
          <Magnetic>
            <ButtonLink href={CONTACT.github} size="lg">
              View the code
            </ButtonLink>
          </Magnetic>
        </div>
        <span className="font-mono text-xs text-subtle-foreground">64-bit installer · no account needed</span>
      </div>
    </section>
  )
}
