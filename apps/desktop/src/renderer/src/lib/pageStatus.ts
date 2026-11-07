// One line of page text for the shell status bar (Browse puts "5 selected" here), kept outside app state so it never re-renders the app.
import { useSyncExternalStore } from 'react'

let text: string | null = null
const listeners = new Set<() => void>()

export function setPageStatus(next: string | null): void {
  if (next === text) return
  text = next
  for (const l of listeners) l()
}

export function subscribePageStatus(l: () => void): () => void {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export const pageStatusText = (): string | null => text

export const selectedText = (count: number): string | null => (count ? `${count.toLocaleString('en-US')} selected` : null)

export const usePageStatus = (): string | null => useSyncExternalStore(subscribePageStatus, pageStatusText)
