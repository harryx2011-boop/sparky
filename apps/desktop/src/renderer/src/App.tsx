import type { Section } from '@sparky/core'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { ClipboardChip } from './components/ClipboardChip'
import { FileDropOverlay } from './components/FileDropOverlay'
import { SparkBurst } from './components/SparkBurst'
import { TooltipProvider } from './components/ui/tooltip'
import { BrowsePage } from './browse/BrowsePage'
import { api } from './lib/api'
import { AppProvider, useApp, useTheme } from './lib/state'
import { ConvertPage } from './pages/ConvertPage'
import { DownloadPage } from './pages/DownloadPage'
import { HistoryPage } from './pages/HistoryPage'
import { QueuePage } from './pages/QueuePage'
import { SettingsPage } from './pages/SettingsPage'
import { ToolsPage } from './pages/ToolsPage'
import { Places, SECTIONS } from './shell/Places'
import { StatusBar } from './shell/StatusBar'
import { TitleBar } from './shell/TitleBar'

const PAGES: Record<Section, { Page: () => ReactNode; bleed?: boolean }> = {
  browse: { Page: BrowsePage, bleed: true },
  convert: { Page: ConvertPage },
  download: { Page: DownloadPage },
  tools: { Page: ToolsPage },
  queue: { Page: QueuePage },
  history: { Page: HistoryPage },
  settings: { Page: SettingsPage },
}

function Shell() {
  const { section, go, settings } = useApp()
  useTheme(settings?.theme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey) return
      const target = SECTIONS.find((s) => s.key === e.key)
      if (target) {
        e.preventDefault()
        go(target.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(
    () =>
      api.queue.onFinished((job) => {
        if (job.status !== 'failed' || !document.hasFocus()) return
        toast.error(job.title, {
          description: job.error,
          action: job.suggestUpdate
            ? {
                label: 'Update downloader',
                onClick: () =>
                  void api.tools.updateYtDlp().then((r) =>
                    r.ok ? toast.success(r.message, { action: { label: 'Retry', onClick: () => void api.queue.retry(job.id) } }) : toast.error(r.message),
                  ),
              }
            : { label: 'Retry', onClick: () => void api.queue.retry(job.id) },
        })
      }),
    [],
  )

  const { Page, bleed } = PAGES[section]
  return (
    <div className="sp-shell flex h-full flex-col text-foreground">
      <TitleBar />
      <div className="flex min-h-0 grow gap-[var(--shell-gap)] px-[var(--shell-gap)]">
        <aside className="sp-panel w-[216px] shrink-0 overflow-hidden bg-[var(--shell-side)]">
          <Places />
        </aside>
        <main className={`sp-panel relative flex min-w-0 grow flex-col bg-[var(--shell-pane)] ${bleed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className={bleed ? 'flex min-h-0 grow flex-col' : 'mx-auto flex min-h-full w-full max-w-[980px] flex-col px-7 py-6'}
            >
              <Page />
            </motion.div>
          </AnimatePresence>
          <ClipboardChip />
        </main>
      </div>
      <StatusBar />
      <SparkBurst />
      <FileDropOverlay />
      <Toaster position="top-right" offset={{ top: 48, right: 20 }} theme={settings?.theme ?? 'dark'} toastOptions={{ className: '!rounded-lg !border !border-border !bg-popover !text-popover-foreground !text-[13px]' }} />
    </div>
  )
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <TooltipProvider delayDuration={250}>
          <Shell />
        </TooltipProvider>
      </AppProvider>
    </MotionConfig>
  )
}
