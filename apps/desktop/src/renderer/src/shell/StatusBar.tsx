// Status bar of the 2.0 shell: contact links on the left (the 1.x footer), the page's own status line and the job pill on the right.
import { CONTACT, DiscordIcon, GmailIcon } from '@sparky/ui'
import { useState } from 'react'
import { api } from '@/lib/api'
import { usePageStatus } from '@/lib/pageStatus'
import { JobPill } from './JobPill'

export function StatusBar() {
  const [copied, setCopied] = useState(false)
  const pageStatus = usePageStatus()
  return (
    <footer className="flex h-9 shrink-0 items-center gap-[18px] px-3 text-[11px] text-subtle-foreground">
      <button type="button" className="flex items-center gap-1.5 transition-colors hover:text-foreground" onClick={() => void api.openExternal(`mailto:${CONTACT.email}`)}>
        <GmailIcon size={12} className="text-foreground" />
        {CONTACT.email}
      </button>
      <button
        type="button"
        aria-label={`Copy Discord username ${CONTACT.discord}`}
        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        onClick={() => {
          void api.copyText(CONTACT.discord)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        }}
      >
        <DiscordIcon size={12} className="text-foreground" />
        <span aria-live="polite">{copied ? 'Copied!' : CONTACT.discord}</span>
      </button>
      <span className="ml-auto font-mono" aria-live="polite">
        {pageStatus}
      </span>
      <JobPill />
    </footer>
  )
}
