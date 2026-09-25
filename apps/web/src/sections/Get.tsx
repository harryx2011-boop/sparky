import { CONTACT } from '@sparky/ui'
import { Download } from 'lucide-react'
import { useScroll } from 'motion/react'
import { useCallback, useRef } from 'react'
import { Magnetic, SplitText } from '../components/motion'
import { SpriteField } from '../components/SpriteField'
import { ButtonLink } from '../components/ui'

export function Get() {
  const sectionRef = useRef<HTMLElement>(null)
  // The galaxy from the top of the page gathers back into the bolt as you arrive.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'center center'] })
  const getProgress = useCallback(() => 1 - scrollYProgress.get(), [scrollYProgress])
  return (
    <section ref={sectionRef} id="get" className="relative overflow-hidden border-t border-[#161616] px-4 pb-32 pt-[320px] sm:px-6 lg:pb-44 lg:pt-[400px]">
      {/* The bolt lives in a band above the words and fades out before they start. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[340px] [mask-image:linear-gradient(180deg,#000_0%,#000_68%,transparent_100%)] lg:h-[420px]">
        <SpriteField getProgress={getProgress} assembleOnMount={false} boltScale={0.7} boltY={0.48} className="size-full opacity-80" />
      </div>
      <div className="relative mx-auto flex max-w-[720px] flex-col items-center gap-7 text-center">
        <h2 className="text-balance text-[clamp(40px,calc(2.6vw+26px),64px)] font-bold leading-[1.04] tracking-[-0.04em]">
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
