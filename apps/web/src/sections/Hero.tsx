import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Download } from 'lucide-react'
import { useRef } from 'react'
import { AppWindow } from '../components/AppWindow'
import { ButtonLink, Sparks } from '../components/ui'

export function Hero() {
  const windowRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: windowRef, offset: ['start end', 'start 0.2'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1])
  const opacity = useTransform(scrollYProgress, [0, 1], [0.6, 1])
  const sparkY = useTransform(scrollYProgress, [0, 1], [0, -60])

  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
      <div aria-hidden className="glow absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2" />
      <motion.div style={reduce ? undefined : { y: sparkY }} className="absolute inset-x-0 top-0 h-[560px]">
        <Sparks count={10} />
      </motion.div>

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-7 text-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex h-[30px] items-center gap-2 rounded-full border border-input px-3 font-mono text-xs text-muted-foreground"
        >
          <span className="size-1.5 rounded-full bg-foreground" />
          Free &amp; open source · Windows 10 &amp; 11
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[1000px] text-balance text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[72px] lg:text-[88px]"
        >
          Convert anything.
          <br />
          Download everything.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[620px] text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          Sparky changes files into the format you need and saves videos and music from links. It all happens on your
          PC: no uploads, no account, nothing to set up.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap justify-center gap-3"
        >
          <ButtonLink href="#get" variant="primary">
            <Download size={16} />
            Download for Windows
          </ButtonLink>
          <ButtonLink href="#convert">See how it works</ButtonLink>
        </motion.div>

        <div ref={windowRef} className="mt-10 w-full [perspective:1600px] sm:mt-14">
          <motion.div style={reduce ? undefined : { rotateX, scale, opacity, transformOrigin: 'center top' }}>
            <AppWindow />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
