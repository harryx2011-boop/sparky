import { CODEC_LABELS, CONCURRENCY_MAX, CONCURRENCY_MIN, OUTPUT_FOLDERS, type Theme, type VideoCodec } from '@sparky/core'
import { CompressionSlider, CONTACT, GithubIcon, LogoMark } from '@sparky/ui'
import { Check, FolderOpen, Loader2, Minus, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Card, PageHeader, PerformancePicker } from '@/components/Controls'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useApp } from '@/lib/state'

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px]">{title}</span>
        {hint && <span className="text-xs text-subtle-foreground">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{title}</h2>
      <Card>{children}</Card>
    </section>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, system, refreshSystem } = useApp()
  const [updating, setUpdating] = useState(false)
  if (!settings) return null
  const folders = Object.values(OUTPUT_FOLDERS).join(', ')

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageHeader title="Settings" />

      <Group title="Files">
        <Row title="Save to" hint={`${settings.outputRoot} · sorted into ${folders}`}>
          <Button size="sm" variant="secondary" onClick={() => void api.files.showInFolder(settings.outputRoot)}>
            <FolderOpen size={13} /> Open
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const dir = await api.files.pickFolder()
              if (dir) await updateSettings({ outputRoot: dir })
            }}
          >
            Change…
          </Button>
        </Row>
        <Row title="Jobs at once" hint="How many conversions and downloads run side by side">
          <div className="flex rounded-lg border border-input p-0.5">
            {Array.from({ length: CONCURRENCY_MAX - CONCURRENCY_MIN + 1 }, (_, i) => i + CONCURRENCY_MIN).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={settings.concurrency === n}
                onClick={() => void updateSettings({ concurrency: n })}
                className={`size-7 rounded-md font-mono text-xs ${settings.concurrency === n ? 'bg-secondary text-foreground' : 'text-subtle-foreground hover:text-foreground'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Defaults">
        <Row title="Performance" hint={system?.gpuLabel}>
          <div className="w-[260px]">
            <PerformancePicker value={settings.performance} onChange={(p) => void updateSettings({ performance: p })} />
          </div>
        </Row>
        <div className="border-b px-4 py-3">
          <CompressionSlider value={settings.compression} onChange={(c) => void updateSettings({ compression: c })} />
        </div>
        <Row title="Video codec" hint="Used for MP4, MKV and MOV unless you pick another in More options">
          <Select
            label="Video codec"
            className="w-56"
            value={settings.codec}
            onChange={(c) => void updateSettings({ codec: c })}
            options={(Object.keys(CODEC_LABELS) as VideoCodec[]).map((c) => ({ value: c, label: CODEC_LABELS[c] }))}
          />
        </Row>
      </Group>

      <Group title="App">
        <Row title="Theme">
          <Segmented<Theme>
            label="Theme"
            value={settings.theme}
            onChange={(t) => void updateSettings({ theme: t })}
            options={[
              { value: 'system', label: 'Match Windows' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row title="Keep running in the tray" hint="Closing the window leaves jobs going. Quit from the tray icon.">
          <Switch checked={settings.closeToTray} onCheckedChange={(v) => void updateSettings({ closeToTray: v })} />
        </Row>
        <Row title="Notifications" hint="A Windows notification when a job finishes or fails">
          <Switch checked={settings.notifications} onCheckedChange={(v) => void updateSettings({ notifications: v })} />
        </Row>
        <Row title="Offer links from the clipboard" hint="When you switch to Sparky with a video link copied, it asks if you want it">
          <Switch checked={settings.clipboardDetection} onCheckedChange={(v) => void updateSettings({ clipboardDetection: v })} />
        </Row>
      </Group>

      <Group title="Built-in tools">
        {system?.tools.map((t) => (
          <Row key={t.id} title={t.label} hint={t.found ? t.path ?? 'Included' : t.optional ? 'Optional. Install it and restart Sparky to use it.' : 'Missing. Reinstalling Sparky brings it back.'}>
            <span className="font-mono text-xs text-subtle-foreground">{t.version}</span>
            {t.found ? <Check size={14} className="text-success" /> : <Minus size={14} className={t.optional ? 'text-subtle-foreground' : 'text-destructive'} />}
          </Row>
        ))}
        <Row title="Downloader updates" hint="Sites change often. Sparky updates yt-dlp when it starts; you can also do it now.">
          <Button
            size="sm"
            variant="secondary"
            disabled={updating}
            onClick={async () => {
              setUpdating(true)
              const res = await api.tools.updateYtDlp()
              setUpdating(false)
              void refreshSystem()
              if (res.ok) toast.success(res.message)
              else toast.error(res.message)
            }}
          >
            {updating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Update now
          </Button>
        </Row>
      </Group>

      <Group title="About">
        <div className="flex items-center gap-3 px-4 py-3">
          <LogoMark size={32} />
          <div className="flex grow flex-col">
            <span className="text-[13px] font-medium">Sparky {system?.appVersion}</span>
            <span className="text-xs text-subtle-foreground">Free and open source under the MIT license. Built on FFmpeg, yt-dlp, Pandoc and 7-Zip.</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void api.openExternal(CONTACT.github)}>
            <GithubIcon size={13} /> GitHub
          </Button>
        </div>
      </Group>
    </div>
  )
}
