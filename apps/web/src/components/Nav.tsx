import { CONTACT, GithubIcon, LogoMark } from '@sparky/ui'
import { ButtonLink } from './ui'

const LINKS = [
  ['Convert', '#convert'],
  ['Download', '#download'],
  ['Performance', '#performance'],
  ['Details', '#details'],
] as const

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1a1a1a] bg-background/80 backdrop-blur-md">
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
          <ButtonLink href="#get" variant="primary" size="sm">
            <span className="sm:hidden">Download</span>
            <span className="hidden sm:inline">Download for Windows</span>
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}
