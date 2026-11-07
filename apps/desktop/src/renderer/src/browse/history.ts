// Back/forward history of opened folders, and the selection each visit had so going back restores it.
import type { Selection } from './selection'

export interface Entry {
  id: number
  path: string
}

export interface History {
  entries: Entry[]
  index: number
}

let nextId = 1
const memory = new Map<number, Selection>()

export function open(h: History | null, path: string): History {
  if (h && current(h).path === path) return h
  const kept = h ? h.entries.slice(0, h.index + 1) : []
  for (const dropped of h ? h.entries.slice(h.index + 1) : []) memory.delete(dropped.id)
  const entries = [...kept, { id: nextId++, path }]
  return { entries, index: entries.length - 1 }
}

export const current = (h: History): Entry => h.entries[h.index]!
export const canBack = (h: History): boolean => h.index > 0
export const canForward = (h: History): boolean => h.index < h.entries.length - 1
export const back = (h: History): History => (canBack(h) ? { ...h, index: h.index - 1 } : h)
export const forward = (h: History): History => (canForward(h) ? { ...h, index: h.index + 1 } : h)

export const remember = (id: number, sel: Selection): void => void memory.set(id, sel)
export const recall = (id: number): Selection | undefined => memory.get(id)
