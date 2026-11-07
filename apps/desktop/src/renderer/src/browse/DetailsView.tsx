// Details view: one virtual row per entry under sortable Name, Modified, Type and Size columns.
import { formatBytes } from '@sparky/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from '../../../components/icons/lucide'
import { DENSITIES, formatDate, typeLabel, type Row, type SortKey } from './model'
import { itemClass, itemData, RowIcon, scrollerClass, useCursorLine, type ViewProps } from './parts'

const COLUMNS: { key: SortKey; label: string; width: string; right?: boolean; cell: (row: Row) => ReactNode }[] = [
  { key: 'name', label: 'Name', width: 'minmax(0,1fr)', cell: (row) => row.name },
  { key: 'modified', label: 'Modified', width: '9.5rem', cell: (row) => formatDate(row.mtime) },
  { key: 'type', label: 'Type', width: '8rem', cell: typeLabel },
  { key: 'size', label: 'Size', width: '6rem', right: true, cell: (row) => (row.dir ? '' : formatBytes(row.size)) },
]

const TEMPLATE = COLUMNS.map((c) => c.width).join(' ')
const STEPS = { down: 1, across: 0 }

interface DetailRowProps {
  row: Row
  index: number
  start: number
  height: number
  selected: boolean
  cursor: boolean
  onPick: ViewProps['onPick']
  onOpen: ViewProps['onOpen']
}

const DetailRow = memo(function DetailRow({ row, index, start, height, selected, cursor, onPick, onOpen }: DetailRowProps) {
  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      {...itemData(selected, cursor)}
      onClick={(e) => onPick(row.name, e)}
      onDoubleClick={() => onOpen(row)}
      className={`absolute left-0 top-0 grid w-full items-center rounded-md ${itemClass} ${row.hidden ? 'opacity-60' : ''}`}
      style={{ height, transform: `translateY(${start}px)`, gridTemplateColumns: TEMPLATE }}
    >
      {COLUMNS.map((col) =>
        col.key === 'name' ? (
          <span key={col.key} role="gridcell" className="flex min-w-0 items-center gap-2.5 px-2">
            <RowIcon row={row} size={height <= 24 ? 14 : 16} />
            <span className="truncate">{row.name}</span>
          </span>
        ) : (
          <span key={col.key} role="gridcell" className={`truncate px-2 text-muted-foreground ${col.key === 'type' ? '' : 'font-mono text-[0.85em]'} ${col.right ? 'text-right' : ''}`}>
            {col.cell(row)}
          </span>
        ),
      )}
    </div>
  )
})

export function DetailsView({ rows, density, selected, cursor, onPick, onOpen, onKey, sort, onSort }: ViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const d = DENSITIES[density]
  const virtual = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => d.row, overscan: 16 })
  useEffect(() => virtual.measure(), [virtual, d.row])
  useCursorLine(scroller, virtual, cursor)

  return (
    <div role="grid" aria-rowcount={rows.length} aria-multiselectable className="flex min-h-0 grow flex-col" style={{ fontSize: d.font }}>
      <div role="row" className="grid h-8 shrink-0 items-center border-b border-[var(--shell-line)] px-3" style={{ gridTemplateColumns: TEMPLATE }}>
        {COLUMNS.map((col) => {
          const on = sort.key === col.key
          const Arrow = sort.desc ? ChevronDown : ChevronUp
          return (
            <button
              key={col.key}
              type="button"
              role="columnheader"
              aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : 'none'}
              onClick={() => onSort({ key: col.key, desc: on ? !sort.desc : false })}
              className={`flex h-full items-center gap-1 px-2 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground hover:text-foreground ${col.right ? 'justify-end' : ''}`}
            >
              {col.label}
              {on && <Arrow size={12} />}
            </button>
          )
        })}
      </div>
      <div ref={scroller} tabIndex={0} onKeyDown={(e) => onKey(e, STEPS)} className={`${scrollerClass} overflow-y-auto px-3 py-1`}>
        <div className="relative w-full" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map((item) => {
            const row = rows[item.index]
            if (!row) return null
            return (
              <DetailRow
                key={row.name}
                row={row}
                index={item.index}
                start={item.start}
                height={item.size}
                selected={selected.has(row.name)}
                cursor={item.index === cursor}
                onPick={onPick}
                onOpen={onOpen}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
