import { Bolt, CONTACT, DiscordIcon, GithubIcon, GmailIcon } from '@sparky/ui'
import { useState } from 'react'

const pill =
  'inline-flex h-10 items-center gap-2 rounded-[10px] border border-input bg-[#141414] px-3.5 text-[13px] text-foreground transition-colors hover:bg-[#1c1c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function Footer() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.discord)
    } catch {
      /* Clipboard can be blocked; the label still shows the handle. */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <footer className="border-t border-[#1a1a1a] px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 text-[13px] text-subtle-foreground">
          <span className="flex items-center gap-2 text-foreground">
            <Bolt size={14} /> Sparky
          </span>
          <span>MIT licensed. Powered by FFmpeg, yt-dlp, Pandoc and 7-Zip.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`mailto:${CONTACT.email}`} className={pill}>
            <GmailIcon size={16} />
            {CONTACT.email}
          </a>
          <button type="button" onClick={copy} className={pill} aria-label={`Copy Discord username ${CONTACT.discord}`}>
            <DiscordIcon size={16} />
            <span aria-live="polite">{copied ? `Copied ${CONTACT.discord}` : CONTACT.discord}</span>
          </button>
          <a href={CONTACT.github} className={pill} aria-label="Sparky on GitHub">
            <GithubIcon size={16} />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
