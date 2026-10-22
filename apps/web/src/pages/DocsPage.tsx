import { MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import { DocBlocks } from '../components/DocBlocks'
import { DocsNav } from '../components/DocsNav'
import { Footer } from '../components/Footer'
import { H1, H2 } from '../components/headings'
import { Nav } from '../components/Nav'
import { DOCS, type DocPage } from '../lib/docs'
import { DOCS_PAGE, HOME } from '../links'

/** The page named by the address: /docs is the index, /docs/<slug> one page, anything else a missing page. */
function pageFromPath(): { page?: DocPage; missing: boolean } {
  const rest = window.location.pathname.slice(DOCS_PAGE.length).replace(/^\/+|\/+$/g, '')
  if (!rest) return { missing: false }
  const page = DOCS.find((d) => d.slug === rest)
  return { page, missing: !page }
}

function DocsHome() {
  return (
    <>
      <h1 className={H1}>Sparky docs</h1>
      <p className="mt-4 max-w-[52ch] text-pretty text-lg leading-relaxed text-muted-foreground">
        Set up Sparky, learn how it works, and see exactly when it uses the internet.
      </p>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2">
        {DOCS.map((d) => (
          <li key={d.slug}>
            <a href={`${DOCS_PAGE}/${d.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-[#3a3a3a]">
              <span className="text-base font-semibold">{d.nav}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{d.intro}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

function DocArticle({ page }: { page: DocPage }) {
  return (
    <article>
      <span className="eyebrow">{page.group}</span>
      <h1 className={`mt-3 ${H1}`}>{page.title}</h1>
      <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
      {page.sections.map((s) => (
        <section key={s.h} className="mt-12">
          <h2 id={s.h.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className={`${H2} scroll-mt-24`}>{s.h}</h2>
          <DocBlocks blocks={s.blocks} />
        </section>
      ))}
      <section className="mt-16 border-t border-border pt-8">
        <h2 className={H2}>Next steps</h2>
        <ul className="flex flex-col gap-3">
          {page.next.map((n) => {
            const target = DOCS.find((d) => d.slug === n.slug)
            return target ? (
              <li key={n.slug} className="text-base text-muted-foreground">
                <a href={`${DOCS_PAGE}/${n.slug}`} className="text-foreground underline decoration-[#3a3a3a] underline-offset-4 hover:decoration-lime">
                  {target.nav}
                </a>{' '}
                {n.why}
              </li>
            ) : null
          })}
        </ul>
      </section>
    </article>
  )
}

export function DocsPage() {
  const { page, missing } = pageFromPath()
  useEffect(() => {
    if (page) document.title = `${page.title} | Sparky docs`
    if (missing) document.title = 'Page not found | Sparky docs'
  }, [page, missing])

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground print:hidden">
        Skip to content
      </a>
      <Nav home={HOME} />
      <main id="main" className="doc-page mx-auto grid w-full max-w-[1200px] gap-10 px-4 pb-24 pt-28 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 lg:pt-36">
        <aside className="lg:sticky lg:top-28 lg:self-start print:hidden">
          <DocsNav active={page?.slug} />
        </aside>
        <div className="min-w-0 max-w-[46rem]">
          {page ? (
            <DocArticle page={page} />
          ) : missing ? (
            <>
              <h1 className={H1}>Page not found</h1>
              <p className="mt-4 text-lg text-muted-foreground">
                That docs page does not exist. <a href={DOCS_PAGE} className="text-foreground underline underline-offset-4">See all docs</a>.
              </p>
            </>
          ) : (
            <DocsHome />
          )}
        </div>
      </main>
      <Footer home={HOME} />
    </MotionConfig>
  )
}
