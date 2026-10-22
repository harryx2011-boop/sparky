import { useEffect, useRef } from 'react'
import { DOCS_PAGE } from '../links'
import { SECTION_LINKS } from './sections'

const LINK = 'flex min-h-11 items-center rounded-lg px-3 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

/** The section links the header hides below lg, behind a button. Escape closes it and returns focus to the button. */
export function MobileMenu({ home, open, onOpenChange }: { home: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onOpenChange(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <div className="lg:hidden print:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => onOpenChange(!open)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menu" className="absolute inset-x-0 top-full border-b border-[#1a1a1a] bg-background px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1200px] flex-col">
            {SECTION_LINKS.map(([label, href]) => (
              <a key={href} href={`${home}${href}`} onClick={() => onOpenChange(false)} className={LINK}>
                {label}
              </a>
            ))}
            <a href={DOCS_PAGE} className={LINK}>
              Docs
            </a>
          </div>
        </nav>
      )}
    </div>
  )
}
