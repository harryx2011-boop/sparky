// Pieces shared by the folder views: the props every view takes, the row icon and a hook that tracks an element's size.
import { useEffect, useState, type RefObject } from 'react'
import { Folder } from '../../../components/icons/lucide'
import { ListExtIcon } from '@/lib/iconSprite'
import type { Density, Row, Sort } from './model'

export interface ViewProps {
  rows: Row[]
  density: Density
  selected: string | null
  onSelect: (name: string) => void
  onOpen: (row: Row) => void
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

export const itemClass =
  'cursor-default select-none outline-none hover:bg-accent/60 data-[selected]:bg-[var(--shell-select)] data-[selected]:text-foreground'
