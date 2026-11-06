// Details view for the comps: shadcn Table rows, Sparky file icons and the shadcn right-click menu.
import { FileIcon } from '@sparky/ui'
import { ArrowLeftRight, Captions, Copy, ExternalLink, Folder, Pencil, Shrink, Trash2 } from '../../../../components/icons/lucide';
import { useRef, type MouseEvent } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ENTRIES, formatSize, SELECTED, type Entry } from '../data'

const COLUMNS = ['Name', 'Modified', 'Type', 'Size']

function typeOf(entry: Entry): string {
  return entry.kind === 'dir' ? 'Folder' : `${entry.ext.toUpperCase()} video`
}

export function FileTable({ onWheel }: { onWheel: (at: { x: number; y: number }) => void }) {
  const at = useRef({ x: 0, y: 0 })
  const remember = (event: MouseEvent) => {
    const box = (event.currentTarget.closest('[data-fm="pane"]') as HTMLElement).getBoundingClientRect()
    at.current = { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onContextMenu={remember} className="min-h-0 flex-1 overflow-auto">
          <Table className="table-fixed text-[13px]">
            <TableHeader className="sticky top-0 bg-[var(--fm-pane)]">
              <TableRow className="border-[var(--fm-line)] hover:bg-transparent">
                {COLUMNS.map((col, i) => (
                  <TableHead key={col} className={`h-7 font-mono text-[10px] font-normal uppercase tracking-wider text-subtle-foreground ${i === 0 ? 'w-auto pl-4' : i === 3 ? 'w-24 pr-4 text-right' : 'w-36'}`}>
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENTRIES.map((entry, i) => {
                const selected = i === SELECTED
                return (
                  <TableRow
                    key={entry.name}
                    data-fm="row"
                    data-selected={selected ? '' : undefined}
                    className="h-[var(--fm-row)] border-0 hover:bg-accent/60 data-[selected]:bg-[var(--fm-select)] data-[selected]:text-[var(--fm-select-text)]"
                  >
                    <TableCell className="py-0 pl-4">
                      <span className="flex items-center gap-2.5">
                        {entry.kind === 'dir' ? <Folder className="size-4 shrink-0 text-subtle-foreground" /> : <FileIcon ext={entry.ext} size={16} />}
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </TableCell>
                    <TableCell data-fm="muted" className="py-0 font-mono text-[11px] text-muted-foreground">{entry.modified}</TableCell>
                    <TableCell data-fm="muted" className="py-0 text-muted-foreground">{typeOf(entry)}</TableCell>
                    <TableCell data-fm="muted" className="py-0 pr-4 text-right font-mono text-[11px] text-muted-foreground">{formatSize(entry.size)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => onWheel(at.current)}><ArrowLeftRight /> Convert to…<ContextMenuShortcut>C</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem><Shrink /> Shrink</ContextMenuItem>
        <ContextMenuItem><Captions /> Get transcript</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem><Pencil /> Rename<ContextMenuShortcut>F2</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem><Copy /> Copy path</ContextMenuItem>
        <ContextMenuItem><ExternalLink /> Open in Explorer</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive"><Trash2 /> Move to Recycle Bin<ContextMenuShortcut>Del</ContextMenuShortcut></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
