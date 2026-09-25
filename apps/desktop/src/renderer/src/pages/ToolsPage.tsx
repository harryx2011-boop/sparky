import type { OpSummary } from '@sparky/core'
import { cn } from '@sparky/ui'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Card, PageHeader } from '@/components/Controls'
import { OpForm } from '@/components/OpForm'
import { api } from '@/lib/api'
import { groupOps, needsText } from '@/lib/ops'

export function ToolsPage() {
  const [ops, setOps] = useState<OpSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    void api.ops.list().then(setOps)
  }, [])

  const groups = useMemo(() => groupOps(ops ?? []), [ops])
  const order = groups.flatMap((g) => g.ops)
  const current = order.find((o) => o.id === selected) ?? order.find((o) => o.available) ?? order[0]

  const move = (e: KeyboardEvent, id: string) => {
    const i = order.findIndex((o) => o.id === id)
    const next = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : -1
    if (next < 0 || next >= order.length) return
    e.preventDefault()
    const target = order[next]!
    setSelected(target.id)
    refs.current.get(target.id)?.focus()
  }

  return (
    <div className="flex grow flex-col gap-4">
      <PageHeader title="Tools" />
      {ops && order.length === 0 && <p className="text-[13px] text-subtle-foreground">No tools are available in this build.</p>}
      {current && (
        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6">
          <Card className="overflow-hidden py-1">
            <div role="listbox" aria-label="Tools" aria-orientation="vertical">
              {groups.map((g) => (
                <div key={g.id} role="group" aria-labelledby={`tools-group-${g.id}`} className="pb-1">
                  <div id={`tools-group-${g.id}`} className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-subtle-foreground">
                    {g.label}
                  </div>
                  {g.ops.map((o) => {
                    const on = o.id === current.id
                    return (
                      <button
                        key={o.id}
                        ref={(el) => {
                          if (el) refs.current.set(o.id, el)
                          else refs.current.delete(o.id)
                        }}
                        type="button"
                        role="option"
                        aria-selected={on}
                        tabIndex={on ? 0 : -1}
                        onClick={() => setSelected(o.id)}
                        onKeyDown={(e) => move(e, o.id)}
                        className={cn(
                          'mx-1 flex w-[calc(100%-8px)] flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          on ? 'bg-accent text-foreground' : 'hover:bg-accent/60',
                          !o.available && !on && 'text-subtle-foreground',
                          o.available && !on && 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <span className="w-full truncate">{o.label}</span>
                        {!o.available && <span className="text-xs text-subtle-foreground">{needsText(o.missing)}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </Card>
          <OpForm key={current.id} op={current} />
        </div>
      )}
    </div>
  )
}
