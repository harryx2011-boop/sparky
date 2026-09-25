import type { Section } from '@sparky/core'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { ClipboardChip } from './components/ClipboardChip'
import { FileDropOverlay } from './components/FileDropOverlay'
import { Footer } from './components/Footer'
import { QueueDock } from './components/QueueDock'
import { SECTIONS, Sidebar } from './components/Sidebar'
import { SparkBurst } from './components/SparkBurst'
import { TitleBar } from './components/TitleBar'
import { TooltipProvider } from './components/ui/tooltip'
import { api } from './lib/api'
import { AppProvider, useApp, useTheme } from './lib/state'
import { ConvertPage } from './pages/ConvertPage'
import { DownloadPage } from './pages/DownloadPage'
import { HistoryPage } from './pages/HistoryPage'
import { QueuePage } from './pages/QueuePage'
import { SettingsPage } from './pages/SettingsPage'
import { ToolsPage } from './pages/ToolsPage'

const PAGES: Record<Section, () => ReactNode> = {
  convert: ConvertPage,
  download: DownloadPage,
  tools: ToolsPage,
  queue: QueuePage,
  history: HistoryPage,
  settings: SettingsPage,
}

function Shell() {
  const { section, go, settings } = useApp()
  useTheme(settings?.theme)

  // Ctrl+1…6 switches sections.
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

  // In-app toast when a job fails while the window is in front.
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

  const Page = PAGES[section]
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 grow">
        <Sidebar />
        <main className="relative flex min-w-0 grow flex-col overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto flex min-h-full w-full max-w-[980px] flex-col px-7 py-6"
            >
              <Page />
            </motion.div>
          </AnimatePresence>
          <ClipboardChip />
        </main>
      </div>
      <QueueDock />
      <Footer />
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
