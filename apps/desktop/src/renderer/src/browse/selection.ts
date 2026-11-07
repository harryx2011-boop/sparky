// Selection model for the folder views, by row name so it survives a re-sort: clicks, Shift/Ctrl, arrows, type-to-select, what Enter opens.

export interface Selection {
  names: ReadonlySet<string>
  anchor: string | null
  cursor: string | null
}

export interface Mods {
  shift?: boolean
  ctrl?: boolean
}

export interface Steps {
  down: number
  across: number
}

export const NONE: Selection = { names: new Set(), anchor: null, cursor: null }

function range(order: readonly string[], from: string | null, to: number): string[] {
  const start = from === null ? -1 : order.indexOf(from)
  if (start < 0) return [order[to]!]
  return order.slice(Math.min(start, to), Math.max(start, to) + 1)
}

export function moveTo(order: readonly string[], sel: Selection, index: number, mods: Mods): Selection {
  const name = order[index]
  if (name === undefined) return sel
  if (mods.shift) {
    const names = mods.ctrl ? new Set([...sel.names, ...range(order, sel.anchor, index)]) : new Set(range(order, sel.anchor, index))
    return { names, anchor: sel.anchor ?? name, cursor: name }
  }
  if (mods.ctrl) return { ...sel, cursor: name }
  return { names: new Set([name]), anchor: name, cursor: name }
}

export function pick(order: readonly string[], sel: Selection, name: string, mods: Mods): Selection {
  if (mods.ctrl && !mods.shift) return toggle(sel, name)
  return moveTo(order, sel, order.indexOf(name), mods)
}

export function toggle(sel: Selection, name: string): Selection {
  const names = new Set(sel.names)
  if (!names.delete(name)) names.add(name)
  return { names, anchor: name, cursor: name }
}

export function selectAll(order: readonly string[]): Selection {
  return { names: new Set(order), anchor: order[0] ?? null, cursor: order[0] ?? null }
}

const MOVES: Record<string, (at: number, last: number, s: Steps) => number | null> = {
  ArrowDown: (at, _, s) => at + s.down,
  ArrowUp: (at, _, s) => at - s.down,
  ArrowRight: (at, _, s) => (s.across ? at + s.across : null),
  ArrowLeft: (at, _, s) => (s.across ? at - s.across : null),
  Home: () => 0,
  End: (_, last) => last,
}

export function targetIndex(key: string, at: number, count: number, steps: Steps): number | null {
  const move = MOVES[key]
  if (!move || count === 0) return null
  if (at < 0) return key === 'End' ? count - 1 : 0
  const to = move(at, count - 1, steps)
  return to === null ? null : Math.min(count - 1, Math.max(0, to))
}

export interface TypeBuffer {
  text: string
  at: number
}

const TYPE_PAUSE_MS = 1000

export function typed(buffer: TypeBuffer | null, key: string, now: number): TypeBuffer {
  const keep = buffer && now - buffer.at < TYPE_PAUSE_MS
  return { text: (keep ? buffer.text : '') + key, at: now }
}

const sameStart = new Intl.Collator(undefined, { sensitivity: 'base' })

export function firstStarting(order: readonly string[], prefix: string): string | null {
  const n = prefix.length
  return order.find((name) => sameStart.compare(name.slice(0, n), prefix) === 0) ?? null
}

export function toOpen<T extends { name: string; dir: boolean }>(rows: readonly T[], names: ReadonlySet<string>): { folder: T | null; files: T[] } {
  const chosen = rows.filter((r) => names.has(r.name))
  const only = chosen.length === 1 ? chosen[0]! : null
  if (only?.dir) return { folder: only, files: [] }
  return { folder: null, files: chosen.filter((r) => !r.dir) }
}
