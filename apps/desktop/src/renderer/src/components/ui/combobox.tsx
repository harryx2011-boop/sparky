import { cn } from '@sparky/ui'
import { Command } from 'cmdk'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'

export interface ComboGroup {
  heading: string
  items: { value: string; label: string; hint?: string; icon?: ReactNode }[]
}

/** Searchable, grouped picker (shadcn's Combobox pattern: Popover + Command). */
export function Combobox({
  value,
  onChange,
  groups,
  placeholder = 'Search formats…',
  display,
  className,
  label,
  icon,
}: {
  value: string
  onChange: (v: string) => void
  groups: ComboGroup[]
  placeholder?: string
  display: ReactNode
  className?: string
  label: string
  /** Leads the closed picker; the search glyph when omitted. */
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon ?? <Search size={13} className="shrink-0 text-subtle-foreground" />}
          {display}
        </span>
        <ChevronDown size={14} className="shrink-0 text-subtle-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <Command loop>
            <div className="flex items-center gap-2 border-b px-2.5">
              <Search size={13} className="text-subtle-foreground" />
              <Command.Input autoFocus placeholder={placeholder} className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-subtle-foreground" />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1">
              <Command.Empty className="py-6 text-center text-xs text-subtle-foreground">No matching format.</Command.Empty>
              {groups.map((g) => (
                <Command.Group key={g.heading} heading={g.heading} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle-foreground">
                  {g.items.map((it) => (
                    <Command.Item
                      key={it.value}
                      value={`${it.label} ${it.hint ?? ''} ${it.value}`}
                      onSelect={() => {
                        onChange(it.value)
                        setOpen(false)
                      }}
                      className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[selected=true]:bg-accent"
                    >
                      <Check size={13} className={cn(value === it.value ? 'opacity-100' : 'opacity-0')} />
                      {it.icon}
                      <span className="font-medium">{it.label}</span>
                      {it.hint && <span className="truncate text-xs text-subtle-foreground">{it.hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
