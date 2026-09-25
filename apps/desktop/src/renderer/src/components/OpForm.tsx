// A form generated from an op's input schema. It never names an op, so a new op needs no UI work.
import { normalizeExt, opUnavailableError, type OpSummary } from '@sparky/core'
import { cn } from '@sparky/ui'
import { FileText, FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/Controls'
import { JobRow } from '@/components/JobRow'
import { Disclosure } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { acceptsText, errorFor, fieldsOf, initial, missingRequired, toArgs, type FieldSpec, type Values } from '@/lib/ops'
import { useApp } from '@/lib/state'

const AUTO = '__auto'

const nameOf = (p: string) => p.split(/[\\/]/).pop() ?? p

/** Same affordance as the Convert page: click, Enter or Space picks files; dropping adds them. */
function FilePicker({ id, value, onChange, multiple, accepts, invalid, describedBy }: { id: string; value: string[]; onChange: (v: string[]) => void; multiple: boolean; accepts: string[]; invalid: boolean; describedBy?: string }) {
  const [over, setOver] = useState(false)
  const add = (paths: string[]) => {
    const fresh = paths.filter(Boolean)
    if (!fresh.length) return
    onChange(multiple ? [...value, ...fresh.filter((p) => !value.includes(p))] : [fresh[0]!])
  }
  const takes = acceptsText(accepts)
  const known = new Set(accepts)
  return (
    <div className="flex flex-col gap-2">
      <button
        id={id}
        type="button"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => void api.files.pick().then(add)}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOver(false)
          add([...e.dataTransfer.files].map((f) => api.files.pathFor(f)))
        }}
        className={cn(
          'group flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[13px] text-subtle-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value.length ? 'h-[64px]' : 'h-[112px]',
          over ? 'border-lime bg-lime/8 text-foreground' : invalid ? 'border-destructive' : 'border-input hover:border-muted-foreground hover:bg-accent/40 hover:text-foreground',
        )}
      >
        <Upload size={value.length ? 16 : 20} />
        <span>
          {multiple ? 'Drop files here, or ' : 'Drop a file here, or '}
          <span className="text-foreground underline-offset-4 group-hover:underline">click to browse</span>
        </span>
        {!value.length && takes && <span className="text-xs text-subtle-foreground/80">{takes}</span>}
      </button>
      {value.length > 0 && (
        <Card className="max-h-[176px] overflow-y-auto">
          {value.map((p) => (
            <div key={p} className="group flex h-9 items-center gap-3 border-b px-3.5 text-[13px] last:border-b-0">
              <FileText size={14} className="shrink-0 text-subtle-foreground" />
              <span className="grow truncate" title={p}>
                {nameOf(p)}
              </span>
              {known.size > 0 && !known.has(normalizeExt(p)) && !known.has(p.split('.').pop()?.toLowerCase() ?? '') && <span className="shrink-0 text-xs text-destructive">Can’t use this type</span>}
              <button
                type="button"
                aria-label={`Remove ${nameOf(p)}`}
                className="rounded-sm p-1 text-subtle-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                onClick={() => onChange(value.filter((x) => x !== p))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

/** Type a value and press Enter or comma to add it; Backspace in an empty box removes the last one. */
function ChipInput({ id, value, onChange, numeric, invalid, describedBy }: { id: string; value: (string | number)[]; onChange: (v: (string | number)[]) => void; numeric?: boolean; invalid: boolean; describedBy?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!parts.length) return
    const items = numeric ? parts.map(Number).filter((n) => Number.isFinite(n)) : parts
    onChange([...value, ...items.filter((i) => !value.includes(i))])
    setDraft('')
  }
  return (
    <div
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border bg-card px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring',
        invalid ? 'border-destructive' : 'border-input',
      )}
    >
      {value.map((v) => (
        <span key={String(v)} className="inline-flex h-5 items-center gap-1 rounded-md bg-secondary pl-1.5 pr-0.5 text-xs text-foreground">
          {String(v)}
          <button type="button" aria-label={`Remove ${String(v)}`} className="rounded-sm p-0.5 text-subtle-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(value.filter((x) => x !== v))}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        inputMode={numeric ? 'numeric' : undefined}
        value={draft}
        placeholder={value.length ? '' : 'Type, then press Enter'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        className="h-6 min-w-24 grow bg-transparent px-1 text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
      />
    </div>
  )
}

function FieldControl({ field, value, onChange, accepts, error }: { field: FieldSpec; value: unknown; onChange: (v: unknown) => void; accepts: string[]; error?: string }) {
  const id = useId()
  const errId = `${id}-error`
  const invalid = Boolean(error)
  const describedBy = error ? errId : undefined
  const wide = field.kind === 'files' || field.kind === 'file' || field.kind === 'list'

  let control: ReactNode
  switch (field.kind) {
    case 'files':
    case 'file':
      control = (
        <FilePicker id={id} value={Array.isArray(value) ? (value as string[]) : typeof value === 'string' && value ? [value] : []} onChange={(v) => onChange(field.kind === 'files' ? v : (v[0] ?? ''))} multiple={field.kind === 'files'} accepts={accepts} invalid={invalid} describedBy={describedBy} />
      )
      break
    case 'list':
      control = <ChipInput id={id} value={(value as (string | number)[]) ?? []} onChange={onChange} numeric={field.numeric} invalid={invalid} describedBy={describedBy} />
      break
    case 'boolean':
      control = (
        <div className="flex h-8 items-center">
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} aria-describedby={describedBy} />
        </div>
      )
      break
    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          inputMode={field.integer ? 'numeric' : 'decimal'}
          min={field.min}
          max={field.max}
          step={field.integer ? 1 : 'any'}
          placeholder={field.required ? '' : 'Automatic'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(invalid && 'border-destructive')}
        />
      )
      break
    case 'choice': {
      const options = field.options ?? []
      const current = value === undefined ? AUTO : String(value)
      const fromString = (s: string) => (s === AUTO ? undefined : options.find((o) => String(o.value) === s)?.value)
      // Chosen from the field alone, so the control never swaps after a pick. A field that can be left unset keeps "Automatic" in a Select.
      const canBeUnset = !field.required && field.default === undefined
      control =
        options.length <= 4 && !canBeUnset ? (
          <Segmented label={field.label} value={current} onChange={(s) => onChange(fromString(s))} options={options.map((o) => ({ value: String(o.value), label: o.label }))} className="w-full" />
        ) : (
          <Select
            label={field.label}
            value={current}
            onChange={(s) => onChange(fromString(s))}
            className="w-full"
            options={[...(canBeUnset ? [{ value: AUTO, label: 'Automatic' }] : []), ...options.map((o) => ({ value: String(o.value), label: o.label }))]}
          />
        )
      break
    }
    default:
      control = field.secret ? (
        <Input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(invalid && 'border-destructive')}
        />
      ) : (
        <Input id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn(invalid && 'border-destructive')} />
      )
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'col-span-2')}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={field.kind === 'choice' ? undefined : id}>{field.label}</Label>
        {field.hint && <span className="truncate text-[11px] text-subtle-foreground">{field.hint}</span>}
      </div>
      {control}
      {error && (
        <p id={errId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function OpForm({ op }: { op: OpSummary }) {
  const { settings, jobs } = useApp()
  const fields = useMemo(() => fieldsOf(op), [op])
  const [values, setValues] = useState<Values>(() => initial(fields))
  const [out, setOut] = useState<string | null>(null)
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const [started, setStarted] = useState<string[]>([])

  const required = fields.filter((f) => f.required)
  const optional = fields.filter((f) => !f.required)
  const mine = jobs.filter((j) => started.includes(j.id))

  const set = (key: string) => (v: unknown) => {
    setValues((vs) => ({ ...vs, [key]: v }))
    if (error && error.field.split(/[.[]/)[0] === key) setError(null)
  }

  const run = async () => {
    const gap = missingRequired(fields, values)
    if (gap) return setError({ field: gap.key, message: gap.message })
    setStarting(true)
    setError(null)
    try {
      const res = await api.ops.start(op.id, { ...toArgs(fields, values), ...(out ? { out } : {}) })
      if (res.ok) {
        setStarted((s) => [...res.jobs.map((j) => j.id), ...s])
        toast.success(`${op.label}: ${res.jobs.length === 1 ? 'added' : `${res.jobs.length} jobs added`} to the queue`)
        return
      }
      const { field, message } = res.error
      const owner = field === 'out' ? 'out' : fields.find((f) => errorFor(field, f.key))?.key
      if (owner) setError({ field: owner, message })
      else toast.error(message)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setStarting(false)
    }
  }

  const control = (f: FieldSpec) => <FieldControl key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} accepts={op.accepts} error={error && errorFor(error.field, f.key) ? error.message : undefined} />

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold leading-tight">{op.label}</h2>
        {!op.available && <p className="text-[13px] leading-relaxed text-muted-foreground">{opUnavailableError(op.label, op.missing)}</p>}
      </div>

      {required.length > 0 && <div className="grid grid-cols-2 gap-3">{required.map(control)}</div>}

      {optional.length > 0 && (
        <Disclosure title="More options" defaultOpen={required.length === 0}>
          <div className="grid grid-cols-2 gap-3">{optional.map(control)}</div>
        </Disclosure>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-3.5 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px]">Save to</span>
            <span className="truncate font-mono text-xs text-subtle-foreground" title={out ?? settings?.outputRoot}>
              {out ?? settings?.outputRoot ?? ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {out && (
              <Button size="sm" variant="ghost" onClick={() => setOut(null)}>
                Reset
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const dir = await api.files.pickFolder()
                if (dir) {
                  setOut(dir)
                  if (error?.field === 'out') setError(null)
                }
              }}
            >
              <FolderOpen size={13} /> Change…
            </Button>
          </div>
        </div>
        {error?.field === 'out' && <p className="text-xs text-destructive">{error.message}</p>}
      </div>

      <div className="flex items-center justify-end">
        <Button size="lg" disabled={!op.available || starting} onClick={() => void run()}>
          {starting && <Loader2 size={14} className="animate-spin" />}
          Run
        </Button>
      </div>

      {mine.length > 0 && (
        <Card className="overflow-hidden">
          {mine.map((j) => (
            <div key={j.id} className="border-b last:border-b-0">
              <JobRow job={j} compact />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
