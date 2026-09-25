import { CONTACT } from '@sparky/ui'
import { ArrowDown, Download } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useCallback, useRef } from 'react'
import { AppWindow } from '../components/AppWindow'
import { Magnetic, SplitText } from '../components/motion'
import { SpriteField } from '../components/SpriteField'
import { ButtonLink } from '../components/ui'
import { useMediaQuery } from '../hooks'

export function Hero() {
  const introRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  // Wide screens put the words on the left and the bolt on the right; small ones stack the bolt above.
  const wide = useMediaQuery('(min-width: 1024px)')

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
      <div ref={introRef} className="relative flex min-h-[100svh] items-center px-4 sm:px-6">
        {/* Calm ground under the headline: the page grid fades out of the text column. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_34%,var(--background)_46%)] lg:bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_44%,transparent_64%)]"
        />
        {/* The field is masked out of the text column, so no dot ever sits behind a letter. */}
        <SpriteField
          getProgress={getProgress}
          boltX={wide ? 0.74 : 0.5}
          boltY={wide ? 0.5 : 0.22}
          boltScale={wide ? 0.66 : 0.32}
          className="absolute inset-0 size-full [mask-image:linear-gradient(180deg,#000_0%,#000_30%,transparent_41%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,transparent_50%,#000_62%)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

        <motion.div
          style={reduce ? undefined : { y: textY, opacity: textOpacity, filter: textBlur }}
          className="relative mx-auto grid w-full max-w-[1200px] pb-16 pt-[44svh] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pt-24"
        >
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:gap-7 lg:text-left">
            <h1 className="text-balance text-[clamp(40px,calc(2.6vw+26px),64px)] font-bold leading-[1.04] tracking-[-0.04em]">
              <SplitText text="Convert anything." delay={0.4} />
              <br />
              <SplitText text="Download everything." delay={0.65} />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[560px] text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              Sparky changes files into the format you need and saves videos and music from links. It all happens on your PC: no
              uploads, no account, nothing to set up.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.15, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-4 lg:items-start"
            >
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                <Magnetic>
                  <ButtonLink href={CONTACT.installer} variant="primary">
                    <Download size={16} />
                    Download for Windows
                  </ButtonLink>
                </Magnetic>
                <Magnetic>
                  <ButtonLink href="#watch">See it work</ButtonLink>
                </Magnetic>
              </div>
              <span className="text-sm text-subtle-foreground">Free and open source. Works on Windows 10 and 11.</span>
            </motion.div>
          </div>
        </motion.div>

        <motion.div style={reduce ? undefined : { opacity: textOpacity }} className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 lg:block">
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
