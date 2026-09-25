import { Upload } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'))

/** Files dragged anywhere over the window light up the whole window; dropping adds them on the Convert page. */
export function FileDropOverlay() {
  const { addFiles, go } = useApp()
  const [over, setOver] = useState(false)

  useEffect(() => {
    // dragenter/dragleave fire for every child crossed, so count them.
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const overWindow = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => api.files.pathFor(f))
      if (!paths.length) return
      go('convert')
      void addFiles(paths)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overWindow)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overWindow)
      window.removeEventListener('drop', drop)
    }
  }, [addFiles, go])

  return (
    <AnimatePresence>
      {over && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6"
          role="status"
        >
          <div className="flex size-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground text-foreground">
            <Upload size={26} />
            <span className="text-[15px] font-medium">Let go to add the files</span>
            <span className="text-xs text-subtle-foreground">They go straight to the Convert page.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
