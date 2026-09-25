// Real marks for the sites Sparky names, one row per site, drawn inline so they paint offline.
// Paths and brand colours come from Simple Icons; the ids match SITES in @sparky/core.
import { siteFor, siteInfo, type SiteId } from '@sparky/core'
import {
  siBandcamp,
  siBilibili,
  siBluesky,
  siDailymotion,
  siFacebook,
  siImgur,
  siInstagram,
  siInternetarchive,
  siKick,
  siLoom,
  siMixcloud,
  siNebula,
  siNiconico,
  siOdysee,
  siPinterest,
  siReddit,
  siRumble,
  siSoundcloud,
  siTed,
  siThreads,
  siTiktok,
  siTumblr,
  siTwitch,
  siVimeo,
  siVk,
  siX,
  siYoutube,
} from 'simple-icons'
import type { SVGProps } from 'react'

interface SimpleIcon {
  path: string
  hex: string
}

/** Sites without a mark in Simple Icons fall back to the generic link glyph. */
export const BRAND_MARKS: Partial<Record<SiteId, SimpleIcon>> = {
  youtube: siYoutube,
  tiktok: siTiktok,
  instagram: siInstagram,
  x: siX,
  vimeo: siVimeo,
  soundcloud: siSoundcloud,
  twitch: siTwitch,
  reddit: siReddit,
  facebook: siFacebook,
  dailymotion: siDailymotion,
  bandcamp: siBandcamp,
  bilibili: siBilibili,
  kick: siKick,
  rumble: siRumble,
  archive: siInternetarchive,
  niconico: siNiconico,
  mixcloud: siMixcloud,
  bluesky: siBluesky,
  threads: siThreads,
  pinterest: siPinterest,
  vk: siVk,
  odysee: siOdysee,
  ted: siTed,
  nebula: siNebula,
  imgur: siImgur,
  tumblr: siTumblr,
  loom: siLoom,
}

/** Brands whose official colour is black (X, TikTok, Threads) take the text colour, so they show on a dark page too. */
function fillFor(hex: string): string {
  const n = parseInt(hex, 16)
  const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum < 0.12 ? 'currentColor' : `#${hex}`
}

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'id'> {
  site: SiteId
  size?: number
  /** Adds the site's name for screen readers; decorative otherwise. */
  labelled?: boolean
}

/** One site's mark in its official colour. Renders nothing for a site without a mark. */
export function BrandMark({ site, size = 16, labelled = false, ...props }: BrandMarkProps) {
  const icon = BRAND_MARKS[site]
  if (!icon) return null
  const name = siteInfo(site).name
  return (
    <svg
      role="img"
      aria-hidden={labelled ? undefined : 'true'}
      aria-label={labelled ? name : undefined}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fillFor(icon.hex)}
      style={{ flexShrink: 0 }}
      {...props}
    >
      {labelled && <title>{name}</title>}
      <path d={icon.path} />
    </svg>
  )
}

/** The mark for whatever site a link points at, or nothing. */
export function LinkMark({ url, ...props }: Omit<BrandMarkProps, 'site'> & { url: string }) {
  const site = siteFor(url)
  return site ? <BrandMark site={site.id} {...props} /> : null
}

/** True when a link points at a site with a mark, so callers can swap out a generic icon. */
export function hasMark(url: string): boolean {
  const site = siteFor(url)
  return Boolean(site && BRAND_MARKS[site.id])
}
