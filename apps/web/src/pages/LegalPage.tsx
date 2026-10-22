import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { DocBlocks } from '../components/DocBlocks'
import { Footer } from '../components/Footer'
import { H1, H2, titleCase } from '../components/headings'
import { Nav } from '../components/Nav'
import { LEGAL_UPDATED, type LegalDoc } from '../lib/legal'
import { HOME } from '../links'

export function LegalPage({ doc }: { doc: LegalDoc }) {
  useEffect(() => {
    document.title = `${doc.title} | Sparky`
  }, [doc.title])

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground print:hidden">
        Skip to content
      </a>
      <Nav home={HOME} />
      <main id="main" className="doc-page mx-auto w-full max-w-[1200px] px-4 pb-24 pt-28 sm:px-6 lg:pt-36">
        <article className="max-w-[46rem]">
          <h1 className={H1}>{doc.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>
          {doc.sections.map((s) => (
            <section key={s.h} className="mt-12">
              <h2 className={`${H2} scroll-mt-24`}>{titleCase(s.h)}</h2>
              <DocBlocks blocks={s.blocks} />
            </section>
          ))}
        </article>
      </main>
      <Footer home={HOME} />
    </MotionConfig>
  )
}
