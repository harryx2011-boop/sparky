// Grid view: large icons in tiles that fill the pane width; tile rows are virtual. Thumbnails arrive in plan step 12.
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { DENSITIES } from './model'
import { itemClass, itemData, RowIcon, scrollerClass, useBox, useCursorLine, type ViewProps } from './parts'

const GAP = 6

export function GridView({ rows, density, selected, cursor, onPick, onOpen, onKey }: ViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const d = DENSITIES[density]
  const { width } = useBox(scroller)
  const columns = Math.max(1, Math.floor((width + GAP) / (d.tile + GAP)))
  const rowHeight = d.tile + GAP
  const virtual = useVirtualizer({ count: Math.ceil(rows.length / columns), getScrollElement: () => scroller.current, estimateSize: () => rowHeight, overscan: 3 })
  useEffect(() => virtual.measure(), [virtual, rowHeight, columns])
  useCursorLine(scroller, virtual, cursor < 0 ? -1 : Math.floor(cursor / columns))

  return (
    <div
      ref={scroller}
      role="listbox"
      aria-label="Files"
      aria-multiselectable
      tabIndex={0}
      onKeyDown={(e) => onKey(e, { down: columns, across: 1 })}
      className={`${scrollerClass} overflow-y-auto px-3 py-2`}
      style={{ fontSize: d.font - 1 }}
    >
      <div className="relative w-full" style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((line) => (
          <div key={line.index} className="absolute left-0 top-0 flex" style={{ gap: GAP, transform: `translateY(${line.start}px)` }}>
            {rows.slice(line.index * columns, (line.index + 1) * columns).map((row, i) => (
              <div
                key={row.name}
                role="option"
                title={row.name}
                {...itemData(selected.has(row.name), line.index * columns + i === cursor)}
                onClick={(e) => onPick(row.name, e)}
                onDoubleClick={() => onOpen(row)}
                className={`flex flex-col items-center gap-1.5 rounded-lg px-1.5 pt-3 text-center ${itemClass} ${row.hidden ? 'opacity-60' : ''}`}
                style={{ width: d.tile, height: d.tile }}
              >
                <RowIcon row={row} size={Math.round(d.tile * 0.4)} />
                <span className="line-clamp-2 break-all leading-tight">{row.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
