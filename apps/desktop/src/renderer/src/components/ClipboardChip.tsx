import { Clipboard, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

/** "Download this?" chip offered when a video link is on the clipboard. */
export function ClipboardChip() {
  const { go, setPendingLink } = useApp()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => api.clipboard.onOffer((o) => setUrl(o.url)), [])
  const dismiss = () => {
    if (url) void api.clipboard.dismiss(url)
    setUrl(null)
  }
  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="sticky bottom-4 left-1/2 z-30 mx-auto -mb-9 mt-auto flex h-9 max-w-[min(560px,90%)] w-fit items-center gap-2 rounded-full border bg-popover pl-3 pr-1 text-[13px] shadow-lg"
          role="status"
        >
          <Clipboard size={14} className="shrink-0 text-muted-foreground" />
          <span className="truncate">
            Download this? <span className="font-mono text-xs text-subtle-foreground">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </span>
          <button
            type="button"
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            onClick={() => {
              setPendingLink(url)
              go('download')
              dismiss()
            }}
          >
            Grab it
          </button>
          <button type="button" aria-label="Dismiss" className="shrink-0 rounded-full p-1.5 text-subtle-foreground hover:bg-accent hover:text-foreground" onClick={dismiss}>
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
