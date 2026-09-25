// Exposes a small, typed API to the UI. The UI never touches Node or the file system directly.
import type { SparkyApi } from '@sparky/core'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>

function listen<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const wrapped = (_e: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...(args as T))
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: SparkyApi = {
  system: { info: () => invoke('system:info') },
  files: {
    pick: () => invoke('files:pick'),
    pickFolder: () => invoke('files:pickFolder'),
    probe: (paths) => invoke('files:probe', paths),
    pathFor: (file) => webUtils.getPathForFile(file),
    showInFolder: (p) => invoke('files:showInFolder', p),
    open: (p) => invoke('files:open', p),
  },
  convert: { start: (paths, settings) => invoke('convert:start', paths, settings) },
  download: {
    inspect: (url) => invoke('download:inspect', url),
    start: (req) => invoke('download:start', req),
  },
  ops: {
    list: () => invoke('ops:list'),
    targets: (paths) => invoke('ops:targets', paths),
    start: (op, args) => invoke('ops:start', op, args),
  },
  queue: {
    list: () => invoke('queue:list'),
    pause: (id) => invoke('queue:pause', id),
    resume: (id) => invoke('queue:resume', id),
    cancel: (id) => invoke('queue:cancel', id),
    retry: (id) => invoke('queue:retry', id),
    remove: (id) => invoke('queue:remove', id),
    reorder: (ids) => invoke('queue:reorder', ids),
    pauseAll: () => invoke('queue:pauseAll'),
    resumeAll: () => invoke('queue:resumeAll'),
    clearFinished: () => invoke('queue:clearFinished'),
    onChange: (l) => listen('queue:change', l),
    onFinished: (l) => listen('queue:finished', l),
  },
  history: {
    search: (q) => invoke('history:search', q),
    rerun: (id) => invoke('history:rerun', id),
    remove: (id) => invoke('history:remove', id),
    clear: () => invoke('history:clear'),
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch),
  },
  tools: { updateYtDlp: () => invoke('tools:updateYtDlp') },
  clipboard: {
    onOffer: (l) => listen('clipboard:offer', l),
    dismiss: (url) => invoke('clipboard:dismiss', url),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    onMaximizedChange: (l) => listen('window:maximized', l),
    isMaximized: () => invoke('window:isMaximized'),
  },
  openExternal: (url) => invoke('shell:openExternal', url),
  copyText: (text) => invoke('clipboard:write', text),
  onNavigate: (l) => listen('navigate', l),
  api: { info: () => invoke('api:info'), revealToken: () => invoke('api:revealToken') },
}

contextBridge.exposeInMainWorld('sparky', api)
