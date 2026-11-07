// Selection state for one folder visit: restored from history, clicks, arrow keys, Ctrl+A and type-to-select.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { recall, remember } from './history'
import type { Row } from './model'
import { firstStarting, moveTo, NONE, pick, selectAll, targetIndex, toggle, typed, type Selection, type Steps, type TypeBuffer } from './selection'

export function useSelection(visit: number, rows: Row[]) {
  const order = useMemo(() => rows.map((r) => r.name), [rows])
  const orderRef = useRef(order)
  orderRef.current = order
  const [sel, setSel] = useState<Selection>(() => recall(visit) ?? NONE)
  const buffer = useRef<TypeBuffer | null>(null)
  useEffect(() => remember(visit, sel), [visit, sel])

  const present = useMemo(() => new Set(order), [order])
  const count = useMemo(() => {
    let n = 0
    for (const name of sel.names) if (present.has(name)) n++
    return n
  }, [present, sel.names])
  const cursor = useMemo(() => (sel.cursor === null ? -1 : order.indexOf(sel.cursor)), [order, sel.cursor])

  const onPick = useCallback((name: string, e: MouseEvent) => setSel((s) => pick(orderRef.current, s, name, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey })), [])

  const onKey = (e: KeyboardEvent, steps: Steps): boolean => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key.toLowerCase() === 'a') {
      setSel(selectAll(order))
      return true
    }
    if (ctrl && e.key === ' ') {
      if (sel.cursor !== null) setSel(toggle(sel, sel.cursor))
      return true
    }
    const to = targetIndex(e.key, cursor, order.length, steps)
    if (to !== null) {
      setSel(moveTo(order, sel, to, { shift: e.shiftKey, ctrl }))
      return true
    }
    const typing = e.key.length === 1 && !ctrl && !e.altKey && (e.key !== ' ' || buffer.current !== null)
    if (!typing) return false
    buffer.current = typed(buffer.current, e.key, e.timeStamp)
    const name = firstStarting(order, buffer.current.text)
    if (name !== null) setSel(moveTo(order, sel, order.indexOf(name), {}))
    return true
  }

  return { selected: sel.names, count, cursor, onPick, onKey }
}
