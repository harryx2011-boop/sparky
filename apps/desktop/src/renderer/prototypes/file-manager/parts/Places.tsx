// Places sidebar for the comps: Quick Access, drives, Sparky's own pages, tags and cloud.
import { Bolt } from '@sparky/ui'
import { ArrowLeftRight, Cloud, Download, FileText, HardDrive, History, Link2, ListVideo, Monitor, Wrench, } from '../../../../components/icons/lucide';
import type { ComponentType } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PLACES } from '../data'

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  monitor: Monitor,
  download: Download,
  'file-text': FileText,
  bolt: ({ className }: { className?: string }) => <Bolt className={className} />,
  drive: HardDrive,
  convert: ArrowLeftRight,
  link: Link2,
  wrench: Wrench,
  queue: ListVideo,
  history: History,
}

const TAGS = [
  { label: 'Client work', color: 'var(--lime)' },
  { label: 'To review', color: 'var(--warning)' },
  { label: 'Keep', color: 'var(--success)' },
]

const ACTIVE = 'Sparky'

export function Places() {
  return (
    <ScrollArea className="h-full">
      <nav aria-label="Places" className="flex flex-col gap-4 px-2 py-3 text-[13px]">
        {PLACES.map((group) => (
          <section key={group.title} className="flex flex-col gap-px">
            <h2 className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">{group.title}</h2>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? FileText
              return (
                <a
                  key={item.label}
                  href="#"
                  data-fm="place"
                  data-active={item.label === ACTIVE ? '' : undefined}
                  className="flex h-7 items-center gap-2.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground data-[active]:bg-accent data-[active]:text-foreground"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.hint && <span data-fm="muted" className="ml-auto font-mono text-[10px] text-subtle-foreground">{item.hint}</span>}
                </a>
              )
            })}
          </section>
        ))}
        <section className="flex flex-col gap-px">
          <h2 className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">Tags</h2>
          {TAGS.map((tag) => (
            <a key={tag.label} href="#" className="flex h-7 items-center gap-2.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground">
              <span className="ml-1 size-2 rounded-full" style={{ background: tag.color }} />
              <span className="ml-0.5">{tag.label}</span>
            </a>
          ))}
        </section>
        <a href="#" className="flex h-7 items-center gap-2.5 rounded-md px-2 text-subtle-foreground hover:bg-accent hover:text-foreground">
          <Cloud className="size-4" />
          Add cloud drive
        </a>
      </nav>
    </ScrollArea>
  )
}
