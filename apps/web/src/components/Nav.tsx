import { CONTACT, GithubIcon, LogoMark } from '@sparky/ui'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import { Magnetic } from './motion'
import { ButtonLink } from './ui'

const LINKS = [
  ['Watch', '#watch'],
  ['Convert', '#convert'],
  ['Download', '#download'],
  ['Performance', '#performance'],
  ['Details', '#details'],
] as const

export function Nav() {
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [solid, setSolid] = useState(false)
  // Transparent over the galaxy, solid once you scroll; hides going down, returns going up.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setSolid(y > 40)
    setHidden(y > 600 && y > prev + 4 ? true : y < prev - 4 ? false : hidden)
  })
  return (
    <motion.header
      animate={{ y: hidden ? -80 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300 ${solid ? 'border-[#1a1a1a] bg-background/75 backdrop-blur-md' : 'border-transparent bg-transparent'}`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
        <a href="#top" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">
          <LogoMark size={28} />
          Sparky
        </a>
        <nav aria-label="Sections" className="hidden gap-8 text-sm text-muted-foreground md:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={CONTACT.github}
            className="hidden size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
            aria-label="Sparky on GitHub"
          >
            <GithubIcon size={17} />
          </a>
          <Magnetic strength={0.2}>
            <ButtonLink href="#get" variant="primary" size="sm">
              <span className="sm:hidden">Download</span>
              <span className="hidden sm:inline">Download for Windows</span>
            </ButtonLink>
          </Magnetic>
        </div>
      </div>
    </motion.header>
  )
}
