// One Sparky 2.0 main window in a given mood: tabs, Places, Details pane, inspector, status bar and the convert wheel.
import { useState } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ENTRIES, FOLDER, formatSize, JOB } from './data'
import type { Mood } from './moods'
import { ConvertWheel } from './parts/ConvertWheel'
import { FileTable } from './parts/FileTable'
import { Inspector } from './parts/Inspector'
import { PathBar } from './parts/PathBar'
import { Places } from './parts/Places'
import { StatusBar } from './parts/StatusBar'
import { TitleBar } from './parts/TitleBar'

const WHEEL_AT = { x: 560, y: 280 }
const PANEL = 'h-full overflow-hidden rounded-[var(--fm-panel-radius)]'

function FolderHeading() {
  const files = ENTRIES.filter((e) => e.kind === 'file')
  const total = files.reduce((sum, e) => sum + e.size, 0)
  return (
    <div className="flex items-baseline gap-3 px-4 pb-2 pt-4">
      <h1 className="text-[26px] font-bold leading-none tracking-tight">{FOLDER.name}</h1>
      <span className="font-mono text-[11px] text-subtle-foreground">
        {ENTRIES.length - files.length} folders · {files.length} videos · {formatSize(total)}
      </span>
    </div>
  )
}

export function Window({ mood, wheelOpen }: { mood: Mood; wheelOpen: boolean }) {
  const [inspector, setInspector] = useState(true)
  const [wheel, setWheel] = useState(wheelOpen ? WHEEL_AT : null)
  const [picked, setPicked] = useState<string | null>(null)
  const job = picked ? { label: `Converting to ${picked}`, progress: 12 } : JOB

  return (
    <div data-mood={mood.id} className="flex size-full flex-col overflow-hidden rounded-[10px] border border-[var(--fm-line)] bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1 px-[var(--fm-gap)]">
        <ResizablePanelGroup>
          <ResizablePanel defaultSize={216} minSize={160} maxSize={320}>
            <div data-fm="panel" className={`${PANEL} bg-[var(--fm-side)]`}>
              <Places />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel minSize={360}>
            <div data-fm="pane" className={`${PANEL} relative flex flex-col bg-[var(--fm-pane)]`}>
              <PathBar inspector={inspector} onInspector={() => setInspector((v) => !v)} />
              {mood.folderHeading && <FolderHeading />}
              <FileTable onWheel={setWheel} />
              {wheel && <ConvertWheel at={wheel} picked={picked} onPick={setPicked} onClose={() => setWheel(null)} />}
            </div>
          </ResizablePanel>
          {inspector && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={288} minSize={240} maxSize={420}>
                <div data-fm="panel" className={`${PANEL} bg-[var(--fm-inspector)]`}>
                  <Inspector onConvert={() => setWheel(WHEEL_AT)} />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <StatusBar job={job} />
    </div>
  )
}
