// List view: names flow down then across in fixed-width columns, like Explorer's List; columns are virtual.
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { DENSITIES } from './model'
import { itemClass, RowIcon, useBox, type ViewProps } from './parts'

const COLUMN_WIDTH = 260

export function ListView({ rows, density, selected, onSelect, onOpen }: ViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const d = DENSITIES[density]
  const { height } = useBox(scroller)
  const perColumn = Math.max(1, Math.floor((height - 8) / d.row))
  const virtual = useVirtualizer({ horizontal: true, count: Math.ceil(rows.length / perColumn), getScrollElement: () => scroller.current, estimateSize: () => COLUMN_WIDTH, overscan: 2 })
  useEffect(() => virtual.measure(), [virtual, perColumn])

  return (
    <div ref={scroller} role="listbox" aria-label="Files" className="min-h-0 grow overflow-x-auto overflow-y-hidden px-3 py-1" style={{ fontSize: d.font }}>
      <div className="relative h-full" style={{ width: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((col) => (
          <div key={col.index} className="absolute top-0 flex flex-col" style={{ width: col.size, transform: `translateX(${col.start}px)` }}>
            {rows.slice(col.index * perColumn, (col.index + 1) * perColumn).map((row) => {
              const isSelected = row.name === selected
              return (
                <div
                  key={row.name}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected ? '' : undefined}
                  onClick={() => onSelect(row.name)}
                  onDoubleClick={() => onOpen(row)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-md px-2 ${itemClass} ${row.hidden ? 'opacity-60' : ''}`}
                  style={{ height: d.row, width: COLUMN_WIDTH - 8 }}
                >
                  <RowIcon row={row} size={d.row <= 24 ? 14 : 16} />
                  <span className="truncate">{row.name}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
