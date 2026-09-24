import {
  CATEGORY_LABELS,
  CODEC_LABELS,
  compressionApplies,
  compressionInfo,
  formatBytes,
  formatDuration,
  formatInfo,
  outputsFor,
  parseTime,
  resolutionApplies,
  resolutionOptions,
  type AdvancedOptions,
  type Category,
  type CompressionLevel,
  type OriginalsMode,
  type ProbeResult,
  type Resolution,
  type VideoCodec,
} from '@sparky/core'
import { cn, CompressionSlider, ResolutionPicker } from '@sparky/ui'
import { Archive, FileText, Image, Music, Upload, Video, X, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, Field, PageHeader, PerformancePicker } from '@/components/Controls'
import { Disclosure } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

const ICONS: Record<Category, LucideIcon> = { video: Video, audio: Music, image: Image, document: FileText, archive: Archive }

const DEFAULT_OUTPUT: Record<Category, string[]> = {
  video: ['mp4'],
  audio: ['mp3'],
  image: ['jpg', 'png'],
  document: ['pdf', 'txt'],
  archive: ['zip'],
}

interface Group {
  category: Category
  files: ProbeResult[]
  /** Formats every file in the group can become. */
  options: string[]
}

function useGroups(files: ProbeResult[]): Group[] {
  return useMemo(() => {
    const map = new Map<Category, ProbeResult[]>()
    for (const f of files) if (f.category) map.set(f.category, [...(map.get(f.category) ?? []), f])
    return [...map.entries()].map(([category, fs]) => {
      const sets = fs.map((f) => new Set(outputsFor(f.path).map((o) => o.ext)))
      const options = [...sets[0]!].filter((e) => sets.every((s) => s.has(e)))
      return { category, files: fs, options }
    })
  }, [files])
}

function DropZone({ onFiles, compact }: { onFiles: (paths: string[]) => void; compact: boolean }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files].map((f) => api.files.pathFor(f)))
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] text-subtle-foreground transition-colors',
        compact ? 'h-[72px]' : 'h-[220px]',
        over ? 'border-foreground bg-accent/60 text-foreground' : 'border-input',
      )}
    >
      <Upload size={compact ? 18 : 24} />
      <span>
        Drop files here, or{' '}
        <button type="button" className="text-foreground underline-offset-4 hover:underline" onClick={() => void api.files.pick().then(onFiles)}>
          browse
        </button>
      </span>
      {!compact && <span className="text-xs text-subtle-foreground/80">Videos, music, photos, documents and archives. Everything stays on this PC.</span>}
    </div>
  )
}

function FileList({ files, onRemove }: { files: ProbeResult[]; onRemove: (p: string) => void }) {
  return (
    <Card className="max-h-[220px] overflow-y-auto">
      <AnimatePresence initial={false}>
        {files.map((f) => {
          const Icon = f.category ? ICONS[f.category] : FileText
          const meta = [
            f.ext.toUpperCase(),
            formatBytes(f.size),
            f.height ? `${f.height >= 2160 ? '4K' : `${f.height}p`}` : undefined,
            f.duration ? formatDuration(f.duration) : undefined,
          ].filter(Boolean)
          return (
            <motion.div
              key={f.path}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 44 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 border-b px-3.5 text-[13px] last:border-b-0"
            >
              <Icon size={14} className="shrink-0 text-subtle-foreground" />
              <span className="grow truncate" title={f.path}>
                {f.name}
              </span>
              {!f.category && <span className="text-xs text-destructive">Can’t convert this type</span>}
              <span className="shrink-0 font-mono text-xs text-subtle-foreground">{meta.join(' · ')}</span>
              <button type="button" aria-label={`Remove ${f.name}`} className="rounded p-1 text-subtle-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100" onClick={() => onRemove(f.path)}>
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </Card>
  )
}

function num(v: string): number | undefined {
  const n = Number(v)
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

export function ConvertPage() {
  const { files, addFiles, removeFile, clearFiles, settings, updateSettings, system, jobs, go } = useApp()
  const groups = useGroups(files)
  const [picked, setPicked] = useState<Partial<Record<Category, string>>>({})
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [originals, setOriginals] = useState<OriginalsMode>('keep')
  const [confirm, setConfirm] = useState(false)
  const [adv, setAdv] = useState<{ codec?: VideoCodec; videoKbps: string; audioKbps: string; trimStart: string; trimEnd: string; width: string; height: string; quality: string }>({
    videoKbps: '',
    audioKbps: '',
    trimStart: '',
    trimEnd: '',
    width: '',
    height: '',
    quality: '',
  })

  if (!settings) return null
  const performance = settings.performance
  const compression = settings.compression
  const codec = adv.codec ?? settings.codec
  const unsupported = files.filter((f) => !f.category)

  const outputOf = (g: Group) => {
    const chosen = picked[g.category]
    if (chosen && g.options.includes(chosen)) return chosen
    return DEFAULT_OUTPUT[g.category].find((d) => g.options.includes(d)) ?? g.options[0] ?? ''
  }
  const outputs = groups.map((g) => ({ group: g, output: outputOf(g) }))
  const ghostscript = Boolean(system?.tools.find((t) => t.id === 'ghostscript')?.found)
  const showCompression = outputs.some((o) => compressionApplies(o.output, { ghostscript }))
  const onlyArchives = outputs.length > 0 && outputs.every((o) => o.group.category === 'archive')
  const videoOut = outputs.filter((o) => resolutionApplies(o.output))
  const showResolution = videoOut.length > 0
  const hasImages = outputs.some((o) => formatInfo(o.output)?.category === 'image')
  const hasTimed = outputs.some((o) => o.group.category === 'video' || o.group.category === 'audio')
  const tallest = Math.max(0, ...videoOut.flatMap((o) => o.group.files.map((f) => f.height ?? 0)))
  const resOptions = resolutionOptions({ sourceHeight: tallest || undefined, performance, gpu: system?.gpu ?? { encoders: [] }, codec })
  const activeRes = resolution !== null && resOptions.some((o) => o.value === resolution && !o.locked && !o.hidden) ? resolution : null
  const totalSize = files.reduce((s, f) => s + f.size, 0)
  const runningAny = jobs.some((j) => j.status === 'running')
  const convertible = groups.reduce((n, g) => n + g.files.length, 0)

  const advanced: AdvancedOptions = {
    codec: adv.codec,
    videoKbps: num(adv.videoKbps),
    audioKbps: num(adv.audioKbps),
    trimStart: parseTime(adv.trimStart),
    trimEnd: parseTime(adv.trimEnd),
    width: num(adv.width),
    height: num(adv.height),
    imageQuality: num(adv.quality) ? Math.min(100, num(adv.quality)!) : undefined,
  }

  const start = async () => {
    try {
      let count = 0
      for (const { group, output } of outputs) {
        if (!output) continue
        const created = await api.convert.start(
          group.files.map((f) => f.path),
          { output, compression, performance, resolution: resolutionApplies(output) ? activeRes : null, originals, advanced },
        )
        count += created.length
      }
      toast.success(`${count} ${count === 1 ? 'file' : 'files'} added to the queue`)
      clearFiles()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Convert" meta={files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatBytes(totalSize)}` : undefined}>
        {files.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearFiles}>
            Clear
          </Button>
        )}
      </PageHeader>

      <DropZone onFiles={(p) => void addFiles(p)} compact={files.length > 0} />

      {files.length > 0 && (
        <>
          <FileList files={files} onRemove={removeFile} />
          {unsupported.length > 0 && <p className="text-xs text-destructive">{unsupported.length === 1 ? 'One file isn’t' : `${unsupported.length} files aren’t`} a type Sparky can convert, so they’ll be skipped.</p>}

          <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-3">
            <div className="flex min-w-0 flex-col gap-3">
              {outputs.map(({ group, output }) => (
                <Field
                  key={group.category}
                  label={outputs.length > 1 ? `${CATEGORY_LABELS[group.category]} (${group.files.length}) become` : 'Output format'}
                  hint={
                    group.files.some((f) => f.ext === output)
                      ? output === 'pdf' && !ghostscript
                        ? 'shrinking PDFs needs the free Ghostscript add-on (see Settings)'
                        : 'same format · just smaller'
                      : undefined
                  }
                >
                  <Combobox
                    label={`Output format for ${CATEGORY_LABELS[group.category]}`}
                    value={output}
                    onChange={(v) => setPicked((p) => ({ ...p, [group.category]: v }))}
                    display={
                      <>
                        {formatInfo(output)?.label ?? output.toUpperCase()}
                        {compressionApplies(output, { ghostscript }) && <span className="text-subtle-foreground"> · {compressionInfo(compression).label}</span>}
                      </>
                    }
                    groups={groupOptions(group.options)}
                  />
                </Field>
              ))}
              {groups.length === 0 && <p className="text-[13px] text-subtle-foreground">Add a file Sparky can convert to pick a format.</p>}
            </div>
            <Field label="Performance" hint={performance === 'max' && system && system.gpu.encoders.length > 0 ? system.gpuLabel : undefined}>
              <PerformancePicker
                value={performance}
                onChange={(p) => void updateSettings({ performance: p })}
                running={runningAny}
                note={system && system.gpu.encoders.length === 0 ? 'No graphics card can help on this PC, so Max uses all of your processor.' : undefined}
              />
            </Field>
          </div>

          {(showResolution || showCompression) && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-6">
              {showResolution ? (
                <Field label="Resolution">
                  <ResolutionPicker options={resOptions} value={activeRes} onChange={setResolution} />
                </Field>
              ) : (
                <span />
              )}
              {showCompression && (
                <CompressionSlider value={compression} onChange={(c: CompressionLevel) => void updateSettings({ compression: c })} variant={onlyArchives ? 'archive' : 'media'} />
              )}
            </div>
          )}

          <Disclosure title="More options: trim, size, sound quality, what happens to originals">
            <div className="grid grid-cols-4 gap-3">
              {showResolution && (
                <Field label="Video type" className="col-span-2">
                  <Select
                    label="Video type"
                    value={codec}
                    onChange={(c) => setAdv((a) => ({ ...a, codec: c }))}
                    options={(Object.keys(CODEC_LABELS) as VideoCodec[]).map((c) => ({ value: c, label: CODEC_LABELS[c] }))}
                  />
                </Field>
              )}
              {showResolution && (
                <Field label="Video data rate" hint="kbps">
                  <Input inputMode="numeric" placeholder="auto, from Compression" value={adv.videoKbps} onChange={(e) => setAdv((a) => ({ ...a, videoKbps: e.target.value }))} />
                </Field>
              )}
              {hasTimed && (
                <Field label="Sound data rate" hint="kbps">
                  <Input inputMode="numeric" placeholder={String(compressionInfo(compression).audioKbps)} value={adv.audioKbps} onChange={(e) => setAdv((a) => ({ ...a, audioKbps: e.target.value }))} />
                </Field>
              )}
              {hasTimed && (
                <Field label="Start at">
                  <Input placeholder="0:00" value={adv.trimStart} onChange={(e) => setAdv((a) => ({ ...a, trimStart: e.target.value }))} />
                </Field>
              )}
              {hasTimed && (
                <Field label="End at">
                  <Input placeholder="end" value={adv.trimEnd} onChange={(e) => setAdv((a) => ({ ...a, trimEnd: e.target.value }))} />
                </Field>
              )}
              {hasImages && (
                <Field label="Width (px)">
                  <Input inputMode="numeric" placeholder="auto" value={adv.width} onChange={(e) => setAdv((a) => ({ ...a, width: e.target.value }))} />
                </Field>
              )}
              {hasImages && (
                <Field label="Height (px)">
                  <Input inputMode="numeric" placeholder="auto" value={adv.height} onChange={(e) => setAdv((a) => ({ ...a, height: e.target.value }))} />
                </Field>
              )}
              {hasImages && (
                <Field label="Image quality (1–100)">
                  <Input inputMode="numeric" placeholder={String(compressionInfo(compression).imageQuality)} value={adv.quality} onChange={(e) => setAdv((a) => ({ ...a, quality: e.target.value }))} />
                </Field>
              )}
              <Field label="Originals" className="col-span-2">
                <Select
                  label="Originals"
                  value={originals}
                  onChange={setOriginals}
                  options={[
                    { value: 'keep', label: 'Keep them (recommended)' },
                    { value: 'replace', label: 'Replace original' },
                    { value: 'trash', label: 'Move original to Recycle Bin after success' },
                  ]}
                />
              </Field>
            </div>
          </Disclosure>

          <div className="flex items-center justify-end gap-3">
            {originals !== 'keep' && <span className="text-xs text-warning">Originals go to the Recycle Bin</span>}
            <Button size="lg" disabled={convertible === 0} onClick={() => (originals === 'keep' ? void start() : setConfirm(true))}>
              Convert {convertible} {convertible === 1 ? 'file' : 'files'}
            </Button>
          </div>
        </>
      )}

      {files.length === 0 && <EmptyHints onQueue={() => go('queue')} />}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={originals === 'replace' ? 'Replace the originals?' : 'Remove the originals afterwards?'}
        description={
          originals === 'replace'
            ? 'Each original goes to the Recycle Bin once its new version is ready, and the new file takes its place. You can restore originals from the Recycle Bin.'
            : 'Each original goes to the Recycle Bin once its new version is ready. You can restore them from the Recycle Bin.'
        }
        confirmLabel="Convert"
        onConfirm={() => void start()}
      />
    </div>
  )
}

function groupOptions(options: string[]) {
  const byCat = new Map<string, { value: string; label: string; hint?: string }[]>()
  for (const ext of options) {
    const f = formatInfo(ext)
    if (!f) continue
    const heading = CATEGORY_LABELS[f.category]
    byCat.set(heading, [...(byCat.get(heading) ?? []), { value: ext, label: f.label, hint: f.note }])
  }
  return [...byCat.entries()].map(([heading, items]) => ({ heading, items }))
}

function EmptyHints({ onQueue }: { onQueue: () => void }) {
  const tips = [
    ['Shrink a file', 'Pick the same format it already has and slide Compression.'],
    ['Mix and match', 'Drop videos, photos and documents together. Each type gets its own format.'],
    ['Keep working', 'Everything waits in the queue below, and keeps going if you close the window.'],
  ] as const
  return (
    <div className="grid grid-cols-3 gap-3">
      {tips.map(([t, d], i) => (
        <Card key={t} className="flex flex-col gap-1 p-4">
          <span className="text-[13px] font-medium">{t}</span>
          <span className="text-xs leading-relaxed text-subtle-foreground">
            {d}
            {i === 2 && (
              <>
                {' '}
                <button type="button" className="text-foreground underline-offset-4 hover:underline" onClick={onQueue}>
                  Open the queue
                </button>
              </>
            )}
          </span>
        </Card>
      ))}
    </div>
  )
}
