import { CONTACT, DiscordIcon, GmailIcon } from '@sparky/ui'
import { useState } from 'react'
import { api } from '@/lib/api'

export function Footer() {
  const [copied, setCopied] = useState(false)
  return (
    <footer className="flex h-[30px] shrink-0 items-center justify-end gap-[18px] border-t px-5 text-[11px] text-subtle-foreground">
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
    </footer>
  )
}
