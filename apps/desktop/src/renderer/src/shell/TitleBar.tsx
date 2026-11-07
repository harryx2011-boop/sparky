// Title bar of the 2.0 shell: Sparky mark, the tab strip (one tab until plan step 20 adds more) and the window buttons.
import { LogoMark } from '@sparky/ui'
import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from '../../../components/icons/lucide'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'
import { folderName } from '../browse/model'
import { SECTIONS } from './Places'

export function TitleBar() {
  const { section, folder } = useApp()
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximizedChange(setMaximized)
  }, [])
  const label = section === 'browse' && folder ? folderName(folder) : (SECTIONS.find((s) => s.id === section)?.label ?? 'Sparky')
  const btn = 'flex h-full w-[46px] items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [-webkit-app-region:no-drag]'
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 pl-3 [-webkit-app-region:drag]" onDoubleClick={() => api.window.toggleMaximize()}>
      <LogoMark size={20} />
      <Tabs value={section} className="min-w-0 [-webkit-app-region:no-drag]">
        <TabsList className="h-8 bg-transparent p-0">
          <TabsTrigger value={section} className="h-8 w-40 justify-start rounded-md px-3 text-[13px] font-normal data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:shadow-none">
            <span className="truncate">{label}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="ml-auto flex h-full">
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
