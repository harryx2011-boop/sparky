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

/** The Sparky bolt. */
export function Bolt({ size = 16, strokeWidth = 2.4, ...props }: IconProps & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

/** The bolt in a rounded tile, used as the logo. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{ width: size, height: size, borderRadius: size * 0.28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--foreground)', color: 'var(--background)', flexShrink: 0 }}
    >
      <Bolt size={Math.round(size * 0.57)} strokeWidth={2.3} />
    </span>
  )
}
