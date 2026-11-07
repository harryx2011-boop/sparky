// Browse page: the open folder in the pane, with back/forward/up, the path bar, the view switch, the view menu and the chosen view.
import { useCallback, useEffect, useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ArrowUp, LayoutGrid, List, Rows3, SlidersHorizontal, type LucideIcon } from '../../../components/icons/lucide'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api } from '@/lib/api'
import { selectedText, setPageStatus } from '@/lib/pageStatus'
import { useApp } from '@/lib/state'
import { DetailsView } from './DetailsView'
import { GridView } from './GridView'
import { canBack, canForward, current } from './history'
import { ListView } from './ListView'
import { DENSITIES, joinPath, parentOf, shownRows, type Density, type Row, type Sort, type ViewMode } from './model'
import type { ViewProps } from './parts'
import { PathBar } from './PathBar'
import { usePref } from './prefs'
import { toOpen, type Steps } from './selection'
import { useFolder } from './useFolder'
import { useSelection } from './useSelection'

const VIEWS: Record<ViewMode, { label: string; icon: LucideIcon; View: (props: ViewProps) => ReactNode }> = {
  details: { label: 'Details', icon: Rows3, View: DetailsView },
  list: { label: 'List', icon: List, View: ListView },
  grid: { label: 'Grid', icon: LayoutGrid, View: GridView },
}

const iconButton = 'grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent'

export function BrowsePage() {
  const { history } = useApp()
  if (!history) return null
  const visit = current(history)
  return <Folder key={visit.id} visit={visit.id} path={visit.path} />
}

function Folder({ visit, path }: { visit: number; path: string }) {
  const { openFolder, history, moveHistory } = useApp()
  const state = useFolder(path)
  const [view, setView] = usePref<ViewMode>('view', 'details')
  const [density, setDensity] = usePref<Density>('density', 'normal')
  const [sort, setSort] = usePref<Sort>('sort', { key: 'name', desc: false })
  const [showHidden, setShowHidden] = usePref('hidden', false)
  const rows = useMemo(() => (state.status === 'ready' ? shownRows(state.rows, sort, showHidden) : []), [state, sort, showHidden])
  const selection = useSelection(visit, rows)
  const parent = parentOf(path)
  const { View } = VIEWS[view] ?? VIEWS.details

  useEffect(() => setPageStatus(selectedText(selection.count)), [selection.count])
  useEffect(() => () => setPageStatus(null), [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey) return
      if (e.key === 'ArrowLeft') moveHistory('back')
      else if (e.key === 'ArrowRight') moveHistory('forward')
      else if (e.key === 'ArrowUp' && parent) openFolder(parent)
      else return
      e.preventDefault()
    }
    const onMouse = (e: globalThis.MouseEvent) => {
      if (e.button === 3) moveHistory('back')
      else if (e.button === 4) moveHistory('forward')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [moveHistory, openFolder, parent])

  const open = useCallback(
    (row: Row) => {
      const target = joinPath(path, row.name)
      if (row.dir) openFolder(target)
      else api.files.open(target).catch((err: Error) => toast.error(`Couldn't open ${row.name}`, { description: err.message }))
    },
    [path, openFolder],
  )

  const onKey = (e: KeyboardEvent, steps: Steps) => {
    if (e.altKey) return
    if (e.key === 'Enter') {
      const { folder, files } = toOpen(rows, selection.selected)
      if (folder) open(folder)
      files.forEach(open)
    } else if (e.key === 'Backspace') moveHistory('back')
    else if (!selection.onKey(e, steps)) return
    e.preventDefault()
  }

  const reveal = () => {
    const only = selection.count === 1 ? rows.find((r) => selection.selected.has(r.name)) : undefined
    if (only) void api.files.showInFolder(joinPath(path, only.name))
    else api.files.open(path).catch((err: Error) => toast.error("Couldn't open File Explorer", { description: err.message }))
  }

  return (
    <div className="flex min-h-0 grow flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--shell-line)] px-2">
        <button type="button" aria-label="Back" title="Back (Alt+Left)" disabled={!history || !canBack(history)} onClick={() => moveHistory('back')} className={iconButton}>
          <ArrowLeft className="size-4" />
        </button>
        <button type="button" aria-label="Forward" title="Forward (Alt+Right)" disabled={!history || !canForward(history)} onClick={() => moveHistory('forward')} className={iconButton}>
          <ArrowRight className="size-4" />
        </button>
        <button type="button" aria-label="Up one folder" title="Up (Alt+Up)" disabled={!parent} onClick={() => parent && openFolder(parent)} className={iconButton}>
          <ArrowUp className="size-4" />
        </button>
        <PathBar path={path} onOpen={openFolder} />
        <span className="shrink-0 px-1 font-mono text-[11px] text-subtle-foreground">{state.status === 'ready' ? `${rows.length.toLocaleString()} ${rows.length === 1 ? 'item' : 'items'}` : ''}</span>
        <div className="flex shrink-0 items-center gap-1">
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
            <DropdownMenuContent align="end" className="w-52">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={reveal}>Open in File Explorer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {state.status === 'error' ? (
        <p className="m-auto max-w-sm px-6 text-center text-[13px] text-muted-foreground">{state.message}</p>
      ) : state.status === 'ready' && rows.length === 0 ? (
        <p className="m-auto text-[13px] text-muted-foreground">This folder is empty.</p>
      ) : (
        <View
          rows={rows}
          density={density}
          selected={selection.selected}
          cursor={selection.cursor}
          onPick={selection.onPick}
          onOpen={open}
          onKey={onKey}
          sort={sort}
          onSort={setSort}
        />
      )}
    </div>
  )
}
