import { Bolt } from '@sparky/ui'
import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/** Frameless window title bar with Windows-style caption buttons. */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximizedChange(setMaximized)
  }, [])
  const btn = 'flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [-webkit-app-region:no-drag]'
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b pl-3.5 text-xs text-subtle-foreground [-webkit-app-region:drag]" onDoubleClick={() => api.window.toggleMaximize()}>
      <span className="flex items-center gap-2">
        <Bolt size={13} className="text-foreground" />
        Sparky
      </span>
      <div className="flex h-full">
        <button type="button" aria-label="Minimize" className={btn} onClick={() => api.window.minimize()}>
          <Minus size={14} />
        </button>
        <button type="button" aria-label={maximized ? 'Restore' : 'Maximize'} className={btn} onClick={() => api.window.toggleMaximize()}>
          {maximized ? <Copy size={12} className="-scale-x-100" /> : <Square size={11} />}
        </button>
        <button type="button" aria-label="Close" className={`${btn} hover:!bg-[#c42b1c] hover:!text-white`} onClick={() => api.window.close()}>
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
