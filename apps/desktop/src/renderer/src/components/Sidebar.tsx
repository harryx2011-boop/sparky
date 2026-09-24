import type { Section } from '@sparky/core'
import { cn } from '@sparky/ui'
import { ArrowLeftRight, Download, History, List, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useApp } from '@/lib/state'
import { Tip } from './ui/tooltip'

const ITEMS: { id: Section; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'convert', label: 'Convert', icon: ArrowLeftRight, key: '1' },
  { id: 'download', label: 'Download', icon: Download, key: '2' },
  { id: 'queue', label: 'Queue', icon: List, key: '3' },
  { id: 'history', label: 'History', icon: History, key: '4' },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, key: '5' },
]

export { ITEMS as SECTIONS }

export function Sidebar() {
  const { section, go, settings, updateSettings, jobs } = useApp()
  const collapsed = settings?.sidebarCollapsed ?? false
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  return (
    <nav aria-label="Sections" className={cn('flex shrink-0 flex-col gap-0.5 border-r px-2 py-3 transition-[width] duration-200', collapsed ? 'w-[52px]' : 'w-[196px]')}>
      {ITEMS.map((it) => {
        const button = (
          <button
            key={it.id}
            type="button"
            onClick={() => go(it.id)}
            aria-current={section === it.id ? 'page' : undefined}
            className={cn(
              'relative flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              section === it.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <it.icon size={15} className="shrink-0" />
            {!collapsed && <span className="grow text-left">{it.label}</span>}
            {it.id === 'queue' && active > 0 && (
              <span className={cn('rounded-full bg-foreground font-mono text-[10px] leading-4 text-background', collapsed ? 'absolute right-1 top-1 min-w-4 px-1' : 'px-1.5')}>{active}</span>
            )}
            {!collapsed && <kbd className="font-mono text-[10px] text-subtle-foreground/60">Ctrl {it.key}</kbd>}
          </button>
        )
        return collapsed ? (
          <Tip key={it.id} content={it.label} side="right">
            {button}
          </Tip>
        ) : (
          button
        )
      })}
      <button
        type="button"
        onClick={() => void updateSettings({ sidebarCollapsed: !collapsed })}
        className="mt-auto flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs text-subtle-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        {!collapsed && 'Collapse'}
      </button>
    </nav>
  )
}
