// Status bar for the comps: folder counts on the left, the live job pill on the right.
import { ENTRIES, formatSize, SELECTED } from '../data'

export function StatusBar({ job }: { job: { label: string; progress: number } }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 px-3 font-mono text-[11px] text-subtle-foreground">
      <span>{ENTRIES.length} items</span>
      <span>1 selected · {formatSize(ENTRIES[SELECTED]!.size)}</span>
      <span className="ml-auto">D: · 1.4 TB free</span>
      <span data-fm="pill" className="flex h-6 items-center gap-2 rounded-full px-2.5 text-foreground">
        <span className="sp-running size-1.5 rounded-full bg-lime" aria-hidden />
        <span className="max-w-64 truncate">{job.label}</span>
        <span data-fm="track" className="h-1 w-16 overflow-hidden rounded-full bg-track">
          <span data-fm="fill" className="block h-full rounded-full bg-lime" style={{ width: `${job.progress}%` }} />
        </span>
        <span>{job.progress}%</span>
      </span>
    </div>
  )
}
