import { cn } from '@sparky/ui'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

/** A command in the mono face under a bar with its shell and a copy button. Long lines scroll inside the block, never the page. */
export function CodeBlock({ code, shell, label, className }: { code: string; shell: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* Clipboard can be blocked; the text stays selectable. */
    }
  }
  return (
    <div className={cn('min-w-0 overflow-hidden rounded-xl border border-border bg-background', className)}>
      <div className="flex h-10 items-center justify-between border-b border-border pl-4 pr-1.5">
        <span className="font-mono text-xs text-subtle-foreground">{shell}</span>
        <span className="sr-only" aria-live="polite">
          {copied ? `Copied ${label}` : ''}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  )
}
