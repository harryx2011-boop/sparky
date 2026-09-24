import { CONTACT } from '@sparky/ui'
import { ArrowDown, Download } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useCallback, useRef } from 'react'
import { AppWindow } from '../components/AppWindow'
import { Magnetic, SplitText } from '../components/motion'
import { SpriteField } from '../components/SpriteField'
import { ButtonLink } from '../components/ui'

export function Hero() {
  const introRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // How far the intro has scrolled away: 0 = bolt, 1 = scattered.
  const { scrollYProgress: away } = useScroll({ target: introRef, offset: ['start start', 'end start'] })
  const getProgress = useCallback(() => away.get() * 1.25, [away])
  const textY = useTransform(away, [0, 1], [0, -140])
  const textOpacity = useTransform(away, [0, 0.55], [1, 0])
  const textBlur = useTransform(away, [0, 0.55], ['blur(0px)', 'blur(8px)'])

  const { scrollYProgress } = useScroll({ target: windowRef, offset: ['start end', 'start 0.2'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [26, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1])
  const opacity = useTransform(scrollYProgress, [0, 1], [0.4, 1])

  return (
    <section id="top" className="relative overflow-hidden">
      <div ref={introRef} className="relative flex min-h-[100svh] items-center justify-center px-4 sm:px-6">
        <SpriteField getProgress={getProgress} className="absolute inset-0 size-full" boltScale={0.74} boltY={0.5} />
        {/* Keeps the headline readable over the brightest dots. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_48%_36%_at_50%_50%,rgba(10,10,10,.72),transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

        <motion.div style={reduce ? undefined : { y: textY, opacity: textOpacity, filter: textBlur }} className="relative mx-auto flex max-w-[1100px] flex-col items-center gap-7 pb-16 pt-24 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="inline-flex h-[30px] items-center gap-2 rounded-full border border-input bg-background/60 px-3 font-mono text-xs text-muted-foreground backdrop-blur"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
            </span>
            Free &amp; open source · Windows 10 &amp; 11
          </motion.span>

          <h1 className="max-w-[1000px] text-balance text-[50px] font-bold leading-[0.95] tracking-[-0.045em] [text-shadow:0_2px_30px_rgba(0,0,0,.6)] sm:text-[76px] lg:text-[96px]">
            <SplitText text="Convert anything." delay={0.55} />
            <br />
            <SplitText text="Download everything." delay={0.8} />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.15, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[600px] text-pretty text-lg leading-relaxed text-muted-foreground [text-shadow:0_1px_16px_rgba(0,0,0,.8)] sm:text-xl"
          >
            Sparky changes files into the format you need and saves videos and music from links. It all happens on your PC: no
            uploads, no account, nothing to set up.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap justify-center gap-3"
          >
            <Magnetic>
              <ButtonLink href={CONTACT.installer} variant="primary">
                <Download size={16} />
                Download for Windows
              </ButtonLink>
            </Magnetic>
            <Magnetic>
              <ButtonLink href="#watch">See it work</ButtonLink>
            </Magnetic>
          </motion.div>
        </motion.div>

        <motion.div style={reduce ? undefined : { opacity: textOpacity }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.a
            href="#watch"
            aria-label="Scroll down"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
            className="flex flex-col items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-subtle-foreground"
          >
            Scroll
            <motion.span animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
              <ArrowDown size={14} />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>

      <div className="relative px-4 pb-24 sm:px-6">
        <div ref={windowRef} className="mx-auto w-full max-w-[1200px] [perspective:1600px]">
          <motion.div style={reduce ? undefined : { rotateX, scale, opacity, transformOrigin: 'center top' }}>
            <AppWindow />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
