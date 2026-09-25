import { CONTACT } from '@sparky/ui'
import { Download } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { Footer } from '../components/Footer'
import { GridCells } from '../components/GridCells'
import { InstallSequence } from '../components/InstallSequence'
import { Magnetic } from '../components/motion'
import { Nav } from '../components/Nav'
import { ButtonLink, Lead } from '../components/ui'
import { HOME } from '../links'

const REQUIREMENTS = [
  ['Windows', 'Windows 10 or 11, 64-bit.'],
  ['Account', 'None. Nothing to sign up for.'],
  ['Where it goes', 'Installs for your Windows user only, in a folder you choose, with Start menu and desktop shortcuts.'],
  ['First run', 'The installer is not code-signed, so Windows SmartScreen may warn you. Choose More info, then Run anyway.'],
  ['Updates', 'Sparky checks for a new version when it opens and installs it when you quit.'],
  ['Office files', 'PowerPoint, OpenOffice and older Word and Excel files convert when LibreOffice is installed. Everything else works as soon as Sparky opens.'],
] as const

export function DownloadPage() {
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <GridCells />
      <Nav home={HOME} cta={CONTACT.installer} />
      <main id="main">
        <section className="relative px-4 pb-20 pt-28 sm:px-6 lg:pb-28 lg:pt-40">
          {/* Calm ground under the copy: the page grid fades out of the text column. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--background)_0%,var(--background)_40%,transparent_70%)] lg:bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_40%,transparent_60%)]"
          />
          <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center gap-6 text-center lg:items-start lg:gap-7 lg:text-left"
            >
              <h1 className="text-balance text-[clamp(40px,calc(2.6vw+26px),64px)] font-bold leading-[1.04] tracking-[-0.04em]">Download Sparky.</h1>
              <p className="max-w-[520px] text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
                One installer sets up Sparky and the tools it runs on. Free, open source, and no account.
              </p>
              <div className="flex flex-col items-center gap-4 lg:items-start">
                <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                  <Magnetic>
                    <ButtonLink href={CONTACT.installer} variant="primary" size="lg">
                      <Download size={17} />
                      Download for Windows
                    </ButtonLink>
                  </Magnetic>
                  <Magnetic>
                    <ButtonLink href={HOME} size="lg">
                      See what it does
                    </ButtonLink>
                  </Magnetic>
                </div>
                <span className="text-sm text-subtle-foreground">The newest release, straight from GitHub.</span>
              </div>
            </motion.div>
            <InstallSequence className="min-w-0" />
          </div>
        </section>

        <section className="border-t border-[#161616] bg-background px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2 className="text-balance text-[clamp(36px,calc(2vw+24px),52px)] font-bold leading-[1.04] tracking-[-0.035em]">Before you install</h2>
              <Lead>One installer, then Sparky is ready. A few things are worth knowing first.</Lead>
              <a href={CONTACT.releases} className="self-start text-sm text-muted-foreground underline decoration-[#3a3a3a] underline-offset-4 transition-colors hover:text-foreground">
                Release notes for every version
              </a>
            </div>
            <dl className="flex flex-col border-t border-[#1f1f1f]">
              {REQUIREMENTS.map(([term, detail]) => (
                <div key={term} className="grid gap-1.5 border-b border-[#1f1f1f] py-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-[15px] font-medium">{term}</dt>
                  <dd className="text-pretty text-[15px] leading-relaxed text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer home={HOME} />
    </MotionConfig>
  )
}
