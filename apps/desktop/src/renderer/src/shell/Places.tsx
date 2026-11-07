// Places panel of the 2.0 shell: Sparky's own sections now; folders, drives and tags join with Browse (plan steps 10, 27).
import type { Section } from '@sparky/core'
import { ArrowLeftRight, Download, History, List, SlidersHorizontal, Wrench, type LucideIcon } from '../../../components/icons/lucide'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApp } from '@/lib/state'

export const SECTIONS: { id: Section; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'convert', label: 'Convert', icon: ArrowLeftRight, key: '1' },
  { id: 'download', label: 'Download', icon: Download, key: '2' },
  { id: 'tools', label: 'Tools', icon: Wrench, key: '3' },
  { id: 'queue', label: 'Queue', icon: List, key: '4' },
  { id: 'history', label: 'History', icon: History, key: '5' },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, key: '6' },
]

function Place({ item }: { item: (typeof SECTIONS)[number] }) {
  const { section, go, jobs } = useApp()
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  return (
    <button
      type="button"
      onClick={() => go(item.id)}
      aria-current={section === item.id ? 'page' : undefined}
      className="flex h-7 items-center gap-2.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
    >
      <item.icon className="size-4 shrink-0" />
      <span className="grow truncate text-left">{item.label}</span>
      {item.id === 'queue' && active > 0 ? (
        <span className="rounded-full bg-lime px-1.5 font-mono text-[10px] leading-4 text-lime-foreground">{active}</span>
      ) : (
        <kbd className="font-mono text-[10px] text-subtle-foreground">Ctrl {item.key}</kbd>
      )}
    </button>
  )
}

export function Places() {
  const settings = SECTIONS.at(-1)!
  return (
    <nav aria-label="Places" className="flex h-full flex-col text-[13px]">
      <ScrollArea className="min-h-0 grow">
        <div className="flex flex-col gap-px px-2 py-3">
          <h2 className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">Sparky</h2>
          {SECTIONS.slice(0, -1).map((item) => (
            <Place key={item.id} item={item} />
          ))}
        </div>
      </ScrollArea>
      <div className="flex flex-col p-2">
        <Place item={settings} />
      </div>
    </nav>
  )
}
