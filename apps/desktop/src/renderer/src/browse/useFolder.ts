// Lists one folder through window.sparky.folders: the first rows at once, the rest after, and a fresh list on every change.
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { mergeListing, toRows, type Row } from './model'

export type FolderState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: Row[] }

export function useFolder(path: string): FolderState {
  const [state, setState] = useState<FolderState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    let seq = 0
    let watchId: string | null = null
    const load = async () => {
      const run = ++seq
      const res = await api.folders.list(path)
      if (!live || run !== seq) return
      if (!res.ok) return setState({ status: 'error', message: res.message })
      setState({ status: 'ready', rows: toRows(res.head) })
      if (!res.rest) return
      const rest = await api.folders.rest(res.rest)
      if (live && run === seq && rest) setState({ status: 'ready', rows: toRows(mergeListing(res.head, rest)) })
    }
    setState({ status: 'loading' })
    void load()
    const off = api.folders.onChange((id) => {
      if (id === watchId) void load()
    })
    void api.folders.watch(path).then((id) => {
      if (live) watchId = id
      else void api.folders.unwatch(id)
    })
    return () => {
      live = false
      off()
      if (watchId) void api.folders.unwatch(watchId)
    }
  }, [path])
  return state
}
