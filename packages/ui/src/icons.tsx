import { siDiscord, siGithub, siGmail } from 'simple-icons'
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function brand(icon: { path: string; title: string }) {
  return function BrandIcon({ size = 16, ...props }: IconProps) {
    return (
      <svg role="img" aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...props}>
        <path d={icon.path} />
      </svg>
    )
  }
}

/** Brand marks from Simple Icons, drawn in the current text colour. */
export const GmailIcon = brand(siGmail)
export const DiscordIcon = brand(siDiscord)
export const GithubIcon = brand(siGithub)

/** The Sparky bolt on its own, as an icon. */
export function Bolt({ size = 16, strokeWidth = 2.4, ...props }: IconProps & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

/** The Sparky logo: a white bolt on a dark tile. Same drawing as the app icon and the favicon. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0A0A0A" stroke="#2A2A2A" strokeWidth="1.5" />
      <path d="M34.7 12 16 35.6h18.5L31.8 52 50.5 28.4H32L34.7 12z" fill="none" stroke="#EDEDED" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
