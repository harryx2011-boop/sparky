// Folder view choices kept in this window's local storage: view, density, sort and hidden items.
import { useCallback, useState } from 'react'

const PREFIX = 'sparky.browse.'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function usePref<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState(() => read(key, fallback))
  const set = useCallback(
    (next: T) => {
      setValue(next)
      write(key, next)
    },
    [key],
  )
  return [value, set]
}
