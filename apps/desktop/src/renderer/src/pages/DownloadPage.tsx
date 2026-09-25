import {
  asLink,
  formatBytes,
  formatDuration,
  FORMATS,
  resolutionOptions,
  siteFor,
  type DownloadExtras,
  type LinkInfo,
  type Resolution,
  type SubtitleMode,
} from '@sparky/core'
import { BrandMark, cn, CompressionSlider, hasMark, LinkMark, ResolutionPicker } from '@sparky/ui'
import { AlertCircle, ClipboardPaste, Link2, ListVideo, Loader2, Play, RefreshCw, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, Field, PageHeader, PerformancePicker } from '@/components/Controls'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

type LoadState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string; suggestUpdate: boolean } | { kind: 'ready'; info: LinkInfo }

const NONE = 'keep'

function convertGroups(mode: 'video' | 'audio') {
  const pick = (cat: 'video' | 'audio') => FORMATS.filter((f) => f.category === cat).map((f) => ({ value: f.ext, label: f.label, hint: f.note }))
  const audio = { heading: 'Audio', items: pick('audio') }
  if (mode === 'audio') return [audio]
  return [{ heading: 'Keep', items: [{ value: NONE, label: 'As downloaded', hint: 'MP4, nothing extra done' }] }, { heading: 'Video', items: pick('video').filter((f) => !['avi'].includes(f.value)) }, audio]
}

export function DownloadPage() {
  const { settings, updateSettings, system, pendingLink, setPendingLink, jobs } = useApp()
  const [url, setUrl] = useState('')
  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('')
  const [quality, setQuality] = useState<Resolution | null>(null)
  const [convertTo, setConvertTo] = useState<string>(NONE)
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [updating, setUpdating] = useState(false)
  const [starting, setStarting] = useState(false)

  const inspect = async (raw: string) => {
    const link = asLink(raw)
    if (!link) {
      setState({ kind: 'error', message: 'That doesn’t look like a link. Copy the address from your browser and paste it here.', suggestUpdate: false })
      return
    }
    setUrl(link)
    setState({ kind: 'loading' })
    try {
      const info = await api.download.inspect(link)
      setSelected(new Set(info.entries.map((e) => e.index)))
      setFilter('')
      setState({ kind: 'ready', info })
    } catch (e) {
      const err = e as Error & { suggestUpdate?: boolean }
      // Errors thrown in the main process lose custom fields over IPC, so read the hint from the text too.
      const message = err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      setState({ kind: 'error', message, suggestUpdate: err.suggestUpdate ?? /Updating|isn't supported|site changed/i.test(message) })
    }
  }

  useEffect(() => {
    if (pendingLink) {
      setPendingLink(null)
      void inspect(pendingLink)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLink])

  const info = state.kind === 'ready' ? state.info : undefined
  const entries = useMemo(() => (info?.entries ?? []).filter((e) => !filter || e.title.toLowerCase().includes(filter.toLowerCase())), [info, filter])

  if (!settings) return null
  const mode = settings.downloadMode
  const extras = settings.downloadExtras
  const setExtras = (patch: Partial<DownloadExtras>) => void updateSettings({ downloadExtras: { ...extras, ...patch } })
  const resOptions = resolutionOptions({ sourceHeight: info?.maxHeight, performance: settings.performance, gpu: system?.gpu ?? { encoders: [] }, codec: settings.codec })
  const activeQuality = quality !== null && resOptions.some((o) => o.value === quality && !o.locked && !o.hidden) ? quality : null
  const target = mode === 'audio' ? audioFormat : convertTo === NONE ? null : convertTo
  const showCompression = mode === 'audio' ? !['wav', 'flac'].includes(audioFormat) : target !== null
  const count = info?.kind === 'playlist' ? selected.size : 1
  // The site behind whatever is typed so far, so its mark shows before Preview is pressed.
  const typedLink = asLink(url)
  const typedSite = typedLink ? siteFor(typedLink) : undefined
  const previewSite = info ? siteFor(info.url) : undefined

  const updateDownloader = async () => {
    setUpdating(true)
    const res = await api.tools.updateYtDlp()
    setUpdating(false)
    if (res.ok) toast.success(res.message, { action: { label: 'Retry', onClick: () => void inspect(url) } })
    else toast.error(res.message)
  }

  const start = async () => {
    if (!info) return
    setStarting(true)
    try {
      await api.download.start({
        url: info.url,
        title: info.title,
        mode,
        quality: mode === 'video' ? activeQuality : null,
        items: info.kind === 'playlist' && selected.size < info.entries.length ? [...selected].sort((a, b) => a - b) : undefined,
        count,
        convertTo: target,
        compression: settings.compression,
        performance: settings.performance,
        extras,
      })
      toast.success(count > 1 ? `${count} items added to the queue` : 'Added to the queue')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Download" meta={jobs.some((j) => j.kind === 'download' && j.status === 'running') ? 'downloading…' : undefined} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void inspect(url)
        }}
      >
        <div className="relative grow">
          <span className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-subtle-foreground">
            {typedLink && hasMark(typedLink) ? <LinkMark url={typedLink} size={15} /> : <Link2 size={15} />}
          </span>
          <Input className="h-10 pl-9 font-mono text-[13px]" placeholder="Paste a link from YouTube or another site" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link" autoFocus />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-10"
          onClick={async () => {
            const text = await navigator.clipboard.readText().catch(() => '')
            if (text) void inspect(text)
          }}
        >
          <ClipboardPaste size={14} /> Paste
        </Button>
        {/* Preview is the main action until a preview is up; then Download takes the accent. */}
        <Button type="submit" size="lg" variant={info ? 'secondary' : 'default'} className="h-10" disabled={!url.trim() || state.kind === 'loading'}>
          {state.kind === 'loading' ? <Loader2 size={14} className="animate-spin" /> : null}
          Preview
        </Button>
      </form>

      {state.kind === 'idle' && (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          {typedSite && typedLink && hasMark(typedLink) ? <BrandMark site={typedSite.id} size={22} labelled /> : <Play size={20} className="text-subtle-foreground" />}
          <span className="text-[13px] font-medium">{typedSite ? `A ${typedSite.name} link. Press Preview to see what’s there.` : 'Paste a link to see what’s there'}</span>
          <span className="max-w-md text-xs leading-relaxed text-subtle-foreground">
            A single video, a playlist or a whole channel. You’ll get a preview first, and for playlists you can tick just the ones you want.
          </span>
        </Card>
      )}

      {state.kind === 'loading' && (
        <Card className="flex items-center gap-4 p-4">
          <div className="h-[84px] w-[150px] animate-pulse rounded-lg bg-secondary" />
          <div className="flex grow flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
          </div>
        </Card>
      )}

      {state.kind === 'error' && (
        <Card className="flex items-start gap-3 border-destructive/40 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
          <div className="flex grow flex-col gap-3">
            <span className="text-[13px]">{state.message}</span>
            <div className="flex gap-2">
              {state.suggestUpdate && (
                <Button size="sm" onClick={() => void updateDownloader()} disabled={updating}>
                  {updating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Update downloader
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => void inspect(url)}>
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {info && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <Card className="flex items-center gap-4 p-4">
            <div className="relative flex h-[84px] w-[150px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
              {info.thumbnail ? <img src={info.thumbnail} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : <Play size={20} className="text-subtle-foreground" />}
              {info.kind === 'playlist' && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{info.entries.length} items</span>}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold" title={info.title}>
                {info.title}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-subtle-foreground">
                {previewSite && <LinkMark url={info.url} size={13} />}
                <span className="truncate">
                  {[previewSite?.name, info.uploader, info.kind === 'playlist' ? `${info.entries.length} items` : undefined, info.duration ? formatDuration(info.duration) : undefined].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="font-mono text-xs text-subtle-foreground">
                {[info.maxHeight ? `up to ${info.maxHeight >= 2160 ? '4K' : `${info.maxHeight}p`}` : undefined, info.sizeEstimate ? `about ${formatBytes(info.sizeEstimate)}` : undefined].filter(Boolean).join(' · ')}
              </span>
            </div>
          </Card>

          {info.kind === 'playlist' && info.entries.length === 0 && (
            <Card className="flex items-start gap-3 p-4">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-subtle-foreground" />
              <span className="text-[13px]">This playlist is empty, or its videos are hidden. Check the link and try another one.</span>
            </Card>
          )}

          {info.kind === 'playlist' && info.entries.length > 0 && (
            <Card className="flex flex-col overflow-hidden">
              <div className="flex h-10 items-center gap-3 border-b px-3.5 text-xs text-subtle-foreground">
                <ListVideo size={14} />
                <span className="grow">
                  {selected.size} of {info.entries.length} selected
                </span>
                <div className="relative w-48">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" />
                  <Input className="h-7 pl-7 text-xs" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search playlist" />
                </div>
                <button
                  type="button"
                  className="rounded-sm hover:text-foreground"
                  onClick={() => setSelected(selected.size === info.entries.length ? new Set() : new Set(info.entries.map((e) => e.index)))}
                >
                  {selected.size === info.entries.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {entries.map((e) => (
                  <label key={e.index} className="flex h-10 cursor-pointer items-center gap-3 border-b px-3.5 text-[13px] last:border-b-0 hover:bg-accent/50">
                    <Checkbox
                      checked={selected.has(e.index)}
                      onCheckedChange={(c) =>
                        setSelected((s) => {
                          const next = new Set(s)
                          if (c) next.add(e.index)
                          else next.delete(e.index)
                          return next
                        })
                      }
                    />
                    <span className="w-7 font-mono text-[11px] text-subtle-foreground">{e.index}</span>
                    <span className="grow truncate">{e.title}</span>
                    <span className="font-mono text-xs text-subtle-foreground">{formatDuration(e.duration)}</span>
                  </label>
                ))}
                {entries.length === 0 && <div className="py-6 text-center text-xs text-subtle-foreground">Nothing matches “{filter}”.</div>}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-[auto_minmax(0,1fr)_260px] items-end gap-3">
            <Field label="Keep">
              <Segmented
                label="Keep"
                value={mode}
                onChange={(m) => void updateSettings({ downloadMode: m })}
                options={[
                  { value: 'video', label: 'Video' },
                  { value: 'audio', label: 'Audio only' },
                ]}
              />
            </Field>
            <Field label={mode === 'audio' ? 'Audio format' : 'Convert to'} hint={target && mode === 'video' ? 'second step after download' : undefined}>
              <Combobox
                label={mode === 'audio' ? 'Audio format' : 'Convert to'}
                value={mode === 'audio' ? audioFormat : convertTo}
                onChange={mode === 'audio' ? setAudioFormat : setConvertTo}
                display={mode === 'audio' ? audioFormat.toUpperCase() : convertTo === NONE ? 'As downloaded (MP4)' : convertTo.toUpperCase()}
                groups={convertGroups(mode)}
              />
            </Field>
            <Field label="Performance">
              <PerformancePicker value={settings.performance} onChange={(p) => void updateSettings({ performance: p })} />
            </Field>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-6">
            {mode === 'video' ? (
              <Field label="Quality">
                <ResolutionPicker options={resOptions} value={activeQuality} onChange={setQuality} originalLabel="Best" />
              </Field>
            ) : (
              <span />
            )}
            {showCompression && (
              <CompressionSlider value={settings.compression} onChange={(c) => void updateSettings({ compression: c })} />
            )}
          </div>

          <Card className="grid grid-cols-2 gap-x-6 gap-y-3 p-4">
            <Toggle label="Cover art" hint="Save the video’s picture inside the file" checked={extras.thumbnail} onChange={(v) => setExtras({ thumbnail: v })} />
            <Toggle label="Titles, artist and chapters" hint="So your music app shows the right names" checked={extras.metadata} onChange={(v) => setExtras({ metadata: v })} />
            <Toggle label="Skip sponsor segments" hint="Cut out ad reads, intros and self-promo" checked={extras.sponsorBlock} onChange={(v) => setExtras({ sponsorBlock: v })} />
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[13px]">Subtitles</span>
                <span className="text-xs text-subtle-foreground">{info.subtitleLangs.length ? `Available: ${info.subtitleLangs.slice(0, 6).join(', ')}` : 'Languages, comma separated'}</span>
              </div>
              <div className="flex items-center gap-2">
                {extras.subtitles !== 'off' && (
                  <Input
                    className="h-8 w-20 font-mono text-xs"
                    value={extras.subtitleLangs.join(',')}
                    onChange={(e) => setExtras({ subtitleLangs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    aria-label="Subtitle languages"
                  />
                )}
                <Segmented<SubtitleMode>
                  label="Subtitles"
                  value={extras.subtitles}
                  onChange={(v) => setExtras({ subtitles: v })}
                  options={[
                    { value: 'off', label: 'Off' },
                    { value: 'download', label: 'Separate file' },
                    ...(mode === 'video' ? [{ value: 'embed' as const, label: 'Inside the video' }] : []),
                  ]}
                />
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-subtle-foreground">
              {mode === 'audio' ? audioFormat.toUpperCase() : target ? `MP4 → ${target.toUpperCase()}` : 'MP4'}
              {mode === 'video' ? ` · ${activeQuality ? (activeQuality === 2160 ? '4K' : `${activeQuality}p`) : 'best quality'}` : ''}
              {extras.sponsorBlock ? ' · sponsor segments skipped' : ''}
            </span>
            <Button size="lg" disabled={count === 0 || starting} onClick={() => void start()}>
              {starting && <Loader2 size={14} className="animate-spin" />}
              {count > 1 ? `Download ${count} items` : 'Download'}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-3')}>
      <span className="flex flex-col">
        <span className="text-[13px]">{label}</span>
        <span className="text-xs text-subtle-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
