import { CODEC_LABELS, OUTPUT_FOLDERS, TOOL_NAMES, type AgentClient, type ApiInfo, type Theme, type VideoCodec } from '@sparky/core'
import { CompressionSlider, CONTACT, GithubIcon, LogoMark } from '@sparky/ui'
import { Check, FolderOpen, Loader2, Minus, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
        {hint && <span className="break-words text-xs text-subtle-foreground">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Group({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">{title}</h2>
      <Card>{children}</Card>
      {note && <p className="px-1 text-xs text-subtle-foreground">{note}</p>}
    </section>
  )
}

function AgentsGroup() {
  const [info, setInfo] = useState<ApiInfo>()
  const [clients, setClients] = useState<AgentClient[]>([])
  const [adding, setAdding] = useState<string>()

  const refresh = useCallback(async () => {
    const [i, c] = await Promise.all([api.api.info(), api.agents.detect()])
    setInfo(i)
    setClients(c)
  }, [])
  useEffect(() => void refresh(), [refresh])

  const add = async (c: AgentClient) => {
    setAdding(c.id)
    const res = await api.agents.install(c.id)
    setAdding(undefined)
    if (res.ok) toast.success(res.message)
    else toast.error(res.message)
    await refresh()
  }

  return (
    <Group title="Agents" note={<>For terminals: the <span className="font-mono">sparky</span> command is installed with Sparky.</>}>
      <Row title="Local API" hint={info ? (info.running ? `Running on port ${info.port}` : 'Not running') : undefined}>
        {info?.running ? <Check size={14} className="text-success" /> : <Minus size={14} className="text-subtle-foreground" />}
      </Row>
      <Row title="Token file" hint="Programs on this PC use it to talk to Sparky.">
        <Button size="sm" variant="secondary" onClick={() => void api.api.revealToken()}>
          <FolderOpen size={13} /> Show file
        </Button>
      </Row>
      {clients
        .filter((c) => c.found)
        .map((c) => (
          <Row key={c.id} title={c.label} hint={c.configPath}>
            {c.installed && c.current ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check size={14} className="text-success" /> Added
              </span>
            ) : (
              <Button size="sm" variant="secondary" disabled={adding !== undefined} onClick={() => void add(c)}>
                {adding === c.id ? <Loader2 size={13} className="animate-spin" /> : c.installed ? <RefreshCw size={13} /> : <Plus size={13} />}
                {c.installed ? 'Update' : `Add to ${c.label}`}
              </Button>
            )}
          </Row>
        ))}
      {clients
        .filter((c) => !c.found)
        .map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-6 border-b px-4 py-3 text-subtle-foreground last:border-b-0">
            <span className="text-[13px]">{c.label}</span>
            <span className="text-xs">Not installed</span>
          </div>
        ))}
    </Group>
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
        <Row title="Batch conversion" hint="Work on several files at the same time">
          <Switch checked={settings.batch} onCheckedChange={(v) => void updateSettings({ batch: v })} aria-label="Batch conversion" />
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
        <Row title="Video type" hint="For MP4, MKV and MOV. Standard plays everywhere; the newer ones make smaller files.">
          <Select
            label="Video type"
            className="w-80"
            value={settings.codec}
            onChange={(c) => void updateSettings({ codec: c })}
            options={(Object.keys(CODEC_LABELS) as VideoCodec[]).map((c) => ({ value: c, label: CODEC_LABELS[c] }))}
          />
        </Row>
      </Group>

      <AgentsGroup />

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

      <Group title="Diagnostics">
        {system?.tools.map((t) => (
          <Row key={t.id} title={t.label} hint={t.found ? (t.optional ? 'Found on this PC' : 'Ready') : t.optional ? `Optional add-on. Install ${TOOL_NAMES[t.id]} and restart Sparky to use it.` : 'Missing. Reinstalling Sparky brings it back.'}>
            {t.found ? <Check size={14} className="text-success" /> : <Minus size={14} className={t.optional ? 'text-subtle-foreground' : 'text-destructive'} />}
          </Row>
        ))}
        <Row title="Downloader updates" hint="Sites change often. Sparky updates its downloader when it starts; you can also do it now.">
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
            <span className="text-xs text-subtle-foreground">Free and open source (MIT license). Built with FFmpeg, yt-dlp, Pandoc and 7-Zip.</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void api.openExternal(CONTACT.github)}>
            <GithubIcon size={13} /> GitHub
          </Button>
        </div>
      </Group>
    </div>
  )
}
