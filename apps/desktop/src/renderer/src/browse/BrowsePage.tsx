// Browse page: the open folder in the pane, with Up, the view switch, the density and hidden-items menu, and the chosen view.
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowUp, LayoutGrid, List, Rows3, SlidersHorizontal, type LucideIcon } from '../../../components/icons/lucide'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'
import { DetailsView } from './DetailsView'
import { GridView } from './GridView'
import { ListView } from './ListView'
import { DENSITIES, folderName, joinPath, parentOf, shownRows, type Density, type Row, type Sort, type ViewMode } from './model'
import type { ViewProps } from './parts'
import { usePref } from './prefs'
import { useFolder } from './useFolder'

const VIEWS: Record<ViewMode, { label: string; icon: LucideIcon; View: (props: ViewProps) => ReactNode }> = {
  details: { label: 'Details', icon: Rows3, View: DetailsView },
  list: { label: 'List', icon: List, View: ListView },
  grid: { label: 'Grid', icon: LayoutGrid, View: GridView },
}

const iconButton = 'grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent'

export function BrowsePage() {
  const { folder } = useApp()
  return folder ? <Folder key={folder} path={folder} /> : null
}

function Folder({ path }: { path: string }) {
  const { openFolder } = useApp()
  const state = useFolder(path)
  const [view, setView] = usePref<ViewMode>('view', 'details')
  const [density, setDensity] = usePref<Density>('density', 'normal')
  const [sort, setSort] = usePref<Sort>('sort', { key: 'name', desc: false })
  const [showHidden, setShowHidden] = usePref('hidden', false)
  const [selected, setSelected] = useState<string | null>(null)
  const rows = useMemo(() => (state.status === 'ready' ? shownRows(state.rows, sort, showHidden) : []), [state, sort, showHidden])
  const parent = parentOf(path)
  const { View } = VIEWS[view] ?? VIEWS.details

  const open = (row: Row) => {
    const target = joinPath(path, row.name)
    if (row.dir) openFolder(target)
    else api.files.open(target).catch((err: Error) => toast.error(`Couldn't open ${row.name}`, { description: err.message }))
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--shell-line)] px-2">
        <button type="button" aria-label="Up one folder" disabled={!parent} onClick={() => parent && openFolder(parent)} className={iconButton}>
          <ArrowUp className="size-4" />
        </button>
        <h1 className="min-w-0 truncate text-[13px] font-medium" title={path}>
          {folderName(path)}
        </h1>
        <span className="font-mono text-[11px] text-subtle-foreground">{state.status === 'ready' ? `${rows.length.toLocaleString()} ${rows.length === 1 ? 'item' : 'items'}` : ''}</span>
        <div className="ml-auto flex items-center gap-1">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)} size="sm" aria-label="View">
            {Object.entries(VIEWS).map(([id, v]) => (
              <ToggleGroupItem key={id} value={id} aria-label={v.label} title={v.label}>
                <v.icon className="size-4" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="View options" title="View options" className={iconButton}>
              <SlidersHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Density</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={density} onValueChange={(v) => setDensity(v as Density)}>
                {Object.entries(DENSITIES).map(([id, d]) => (
                  <DropdownMenuRadioItem key={id} value={id}>
                    {d.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showHidden} onCheckedChange={(on) => setShowHidden(on === true)}>
                Show hidden items
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {state.status === 'error' ? (
        <p className="m-auto max-w-sm px-6 text-center text-[13px] text-muted-foreground">{state.message}</p>
      ) : state.status === 'ready' && rows.length === 0 ? (
        <p className="m-auto text-[13px] text-muted-foreground">This folder is empty.</p>
      ) : (
        <View rows={rows} density={density} selected={selected} onSelect={setSelected} onOpen={open} sort={sort} onSort={setSort} />
      )}
    </div>
  )
}
