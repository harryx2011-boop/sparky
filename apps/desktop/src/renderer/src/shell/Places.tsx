// Places panel of the 2.0 shell: Quick access folders and drives open in the pane, then Sparky's own sections; tags join in plan step 27.
import type { Place as FolderPlaceInfo, Places as PlaceList, Section } from '@sparky/core'
import { useEffect, useState } from 'react'
import { ArrowLeftRight, Download, FileText, HardDrive, History, Image, List, Monitor, SlidersHorizontal, Wrench, Zap, type LucideIcon } from '../../../components/icons/lucide'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

export const SECTIONS: { id: Section; label: string; icon: LucideIcon; key: string }[] = [
  { id: 'convert', label: 'Convert', icon: ArrowLeftRight, key: '1' },
  { id: 'download', label: 'Download', icon: Download, key: '2' },
  { id: 'tools', label: 'Tools', icon: Wrench, key: '3' },
  { id: 'queue', label: 'Queue', icon: List, key: '4' },
  { id: 'history', label: 'History', icon: History, key: '5' },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, key: '6' },
]

const FOLDER_ICONS: Record<FolderPlaceInfo['icon'], LucideIcon> = { desktop: Monitor, downloads: Download, documents: FileText, pictures: Image, sparky: Zap, drive: HardDrive }

const placeClass =
  'flex h-7 items-center gap-2.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground'

function FolderPlace({ place }: { place: FolderPlaceInfo }) {
  const { section, folder, openFolder } = useApp()
  const Icon = FOLDER_ICONS[place.icon]
  return (
    <button type="button" title={place.path} onClick={() => openFolder(place.path)} aria-current={section === 'browse' && folder === place.path ? 'page' : undefined} className={placeClass}>
      <Icon className="size-4 shrink-0" />
      <span className="grow truncate text-left">{place.label}</span>
    </button>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-px px-2 pt-3">
      <h2 className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">{title}</h2>
      {children}
    </div>
  )
}

function Place({ item }: { item: (typeof SECTIONS)[number] }) {
  const { section, go, jobs } = useApp()
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length
  return (
    <button
      type="button"
      onClick={() => go(item.id)}
      aria-current={section === item.id ? 'page' : undefined}
      className={placeClass}
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
  const [places, setPlaces] = useState<PlaceList | null>(null)
  useEffect(() => {
    void api.folders.places().then(setPlaces)
  }, [])
  return (
    <nav aria-label="Places" className="flex h-full flex-col text-[13px]">
      <ScrollArea className="min-h-0 grow">
        <div className="pb-3">
          {places && (
            <Group title="Quick access">
              {places.quick.map((p) => (
                <FolderPlace key={p.path} place={p} />
              ))}
            </Group>
          )}
          {places && places.drives.length > 0 && (
            <Group title="Drives">
              {places.drives.map((p) => (
                <FolderPlace key={p.path} place={p} />
              ))}
            </Group>
          )}
          <Group title="Sparky">
            {SECTIONS.slice(0, -1).map((item) => (
              <Place key={item.id} item={item} />
            ))}
          </Group>
        </div>
      </ScrollArea>
      <div className="flex flex-col p-2">
        <Place item={settings} />
      </div>
    </nav>
  )
}
