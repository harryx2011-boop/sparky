import { cn } from '@sparky/ui'
import { DOCS } from '../lib/docs'
import { DOCS_PAGE } from '../links'

const GROUPS = [...new Set(DOCS.map((d) => d.group))]

export function DocsNav({ active }: { active?: string }) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="eyebrow px-3 pb-1">{group}</span>
          {DOCS.filter((d) => d.group === group).map((d) => (
            <a
              key={d.slug}
              href={`${DOCS_PAGE}/${d.slug}`}
              aria-current={d.slug === active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors hover:text-foreground',
                d.slug === active ? 'bg-secondary text-foreground' : 'text-muted-foreground',
              )}
            >
              {d.nav}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )
}
