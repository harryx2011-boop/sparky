import { describeSaving, formatDuration, type HistoryEntry, type HistoryQuery } from '@sparky/core'
import { AlertCircle, FolderOpen, Loader2, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, PageHeader } from '@/components/Controls'
import { JobIcons } from '@/components/JobRow'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Tip } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

function when(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  return d.toLocaleDateString()
}

export function HistoryPage() {
  const { jobs } = useApp()
  const [query, setQuery] = useState<HistoryQuery>({ text: '', kind: 'all', status: 'all' })
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [rerunning, setRerunning] = useState<string | null>(null)
  const finishedCount = jobs.filter((j) => j.status === 'done' || j.status === 'failed' || j.status === 'canceled').length

  const load = useCallback(async () => setEntries(await api.history.search(query)), [query])
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 120)
    return () => window.clearTimeout(t)
  }, [load, finishedCount])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="History" meta={`${entries.length} ${entries.length === 1 ? 'job' : 'jobs'}`}>
        {entries.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
            <Trash2 size={13} /> Clear history
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center gap-2">
        <div className="relative grow">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle-foreground" />
          <Input className="pl-8" placeholder="Search by file name or link" value={query.text} onChange={(e) => setQuery((q) => ({ ...q, text: e.target.value }))} aria-label="Search history" />
        </div>
        <Segmented
          label="Type"
          value={query.kind ?? 'all'}
          onChange={(kind) => setQuery((q) => ({ ...q, kind }))}
          options={[
            { value: 'all', label: 'All' },
            { value: 'convert', label: 'Conversions' },
            { value: 'download', label: 'Downloads' },
          ]}
        />
        <Segmented
          label="Result"
          value={query.status ?? 'all'}
          onChange={(status) => setQuery((q) => ({ ...q, status }))}
          options={[
            { value: 'all', label: 'Any' },
            { value: 'done', label: 'Done' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {entries.length === 0 && <div className="px-6 py-12 text-center text-[13px] text-subtle-foreground">{query.text ? 'Nothing matches that search.' : 'Finished jobs are saved here so you can find or repeat them.'}</div>}
        {entries.map((h) => {
          const detail = h.status === 'failed' ? h.error : h.status === 'canceled' ? 'Canceled' : describeSaving(h.sizeBefore, h.sizeAfter) ?? `${h.outputs.length} ${h.outputs.length === 1 ? 'file' : 'files'}`
          return (
            <div key={h.id} className="group flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span className="flex h-8 w-14 shrink-0 items-center">
                <JobIcons job={h} size={18} badge={h.status === 'failed' ? <AlertCircle size={10} className="text-destructive" /> : undefined} />
              </span>
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[13px] font-medium" title={h.source}>
                  {h.title}
                </span>
                <span className={h.status === 'failed' ? 'truncate text-xs text-destructive' : 'truncate text-xs text-subtle-foreground'}>{detail}</span>
              </div>
              <span className="shrink-0 text-right font-mono text-[11px] text-subtle-foreground">
                {when(h.finishedAt)}
                <br />
                {h.durationMs > 0 ? `took ${formatDuration(h.durationMs / 1000)}` : ''}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Tip content="Run again with the same settings">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={rerunning === h.id}
                    onClick={async () => {
                      setRerunning(h.id)
                      try {
                        const res = await api.history.rerun(h.id)
                        if (!res.ok) toast.error(res.error.message)
                        else toast.success(res.jobs.length ? 'Added to the queue' : 'Nothing to run again')
                      } catch (e) {
                        toast.error((e as Error).message)
                      } finally {
                        setRerunning(null)
                      }
                    }}
                  >
                    {rerunning === h.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Run again
                  </Button>
                </Tip>
                {h.outputs[0] && (
                  <Tip content="Show in folder">
                    <Button size="icon-sm" variant="ghost" aria-label="Show in folder" onClick={() => void api.files.showInFolder(h.outputs[0]!)}>
                      <FolderOpen size={13} />
                    </Button>
                  </Tip>
                )}
                <Tip content="Remove from history">
                  <Button size="icon-sm" variant="ghost" aria-label="Remove from history" onClick={() => void api.history.remove(h.id).then(load)}>
                    <X size={14} />
                  </Button>
                </Tip>
              </div>
            </div>
          )
        })}
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all history?"
        description="This only forgets the list of past jobs. Your files stay where they are."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => void api.history.clear().then(load)}
      />
    </div>
  )
}
