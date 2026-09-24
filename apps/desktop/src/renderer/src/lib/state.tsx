import type { Job, ProbeResult, Section, Settings, SystemInfo } from '@sparky/core'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'

interface AppState {
  section: Section
  go: (s: Section) => void
  settings: Settings | null
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  system: SystemInfo | null
  refreshSystem: () => Promise<void>
  jobs: Job[]
  /** Files waiting on the Convert page, kept when switching sections. */
  files: ProbeResult[]
  addFiles: (paths: string[]) => Promise<void>
  removeFile: (path: string) => void
  clearFiles: () => void
  /** A link handed over by the tray or the clipboard chip. */
  pendingLink: string | null
  setPendingLink: (url: string | null) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<Section>('convert')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [files, setFiles] = useState<ProbeResult[]>([])
  const [pendingLink, setPendingLink] = useState<string | null>(null)

  const refreshSystem = useCallback(async () => setSystem(await api.system.info()), [])

  useEffect(() => {
    void api.settings.get().then(setSettings)
    void refreshSystem()
    void api.queue.list().then(setJobs)
    const offChange = api.queue.onChange(setJobs)
    const offNav = api.onNavigate(({ section: s, url }) => {
      setSection(s)
      if (url) setPendingLink(url)
    })
    return () => {
      offChange()
      offNav()
    }
  }, [refreshSystem])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    setSettings(await api.settings.set(patch))
  }, [])

  const addFiles = useCallback(async (paths: string[]) => {
    const fresh = paths.filter(Boolean)
    if (!fresh.length) return
    const probed = await api.files.probe(fresh)
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.path))
      return [...prev, ...probed.filter((p) => !seen.has(p.path))]
    })
  }, [])

  const value = useMemo<AppState>(
    () => ({
      section,
      go: setSection,
      settings,
      updateSettings,
      system,
      refreshSystem,
      jobs,
      files,
      addFiles,
      removeFile: (p) => setFiles((fs) => fs.filter((f) => f.path !== p)),
      clearFiles: () => setFiles([]),
      pendingLink,
      setPendingLink,
    }),
    [section, settings, updateSettings, system, refreshSystem, jobs, files, addFiles, pendingLink],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}

/** Follows the Windows light/dark theme unless the user picked one. */
export function useTheme(theme: Settings['theme'] | undefined): void {
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && mql.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])
}
