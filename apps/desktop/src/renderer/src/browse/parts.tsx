// Pieces shared by the folder views: the props every view takes, the row icon, size tracking, and focus plus cursor scrolling.
import type { Virtualizer } from '@tanstack/react-virtual'
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import { Folder } from '../../../components/icons/lucide'
import { ListExtIcon } from '@/lib/iconSprite'
import type { Density, Row, Sort } from './model'
import type { Steps } from './selection'

export interface ViewProps {
  rows: Row[]
  density: Density
  selected: ReadonlySet<string>
  cursor: number
  onPick: (name: string, e: MouseEvent) => void
  onOpen: (row: Row) => void
  onKey: (e: KeyboardEvent, steps: Steps) => void
  sort: Sort
  onSort: (sort: Sort) => void
}

export function RowIcon({ row, size }: { row: Row; size: number }) {
  return row.dir ? <Folder size={size} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" /> : <ListExtIcon ext={row.ext} size={size} />
}

export function useBox(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [box, setBox] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => entry && setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return box
}

export function useCursorLine<S extends Element, I extends Element>(scroller: RefObject<HTMLElement | null>, virtual: Virtualizer<S, I>, line: number): void {
  useEffect(() => scroller.current?.focus({ preventScroll: true }), [scroller])
  useEffect(() => {
    if (line >= 0) virtual.scrollToIndex(line)
  }, [virtual, line])
}

export const scrollerClass = 'group min-h-0 grow outline-none'

export const itemClass =
  'cursor-default select-none outline-none hover:bg-accent/60 data-[selected]:bg-[var(--shell-select)] data-[selected]:text-foreground group-focus:data-[cursor]:ring-1 group-focus:data-[cursor]:ring-inset group-focus:data-[cursor]:ring-ring/60'

export const itemData = (selected: boolean, cursor: boolean) => ({ 'aria-selected': selected, 'data-selected': selected ? '' : undefined, 'data-cursor': cursor ? '' : undefined })
