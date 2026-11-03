// Real marks for the sites Sparky names, one row per site, drawn inline so they paint offline.
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
import { MARKS } from './brand-marks.generated'
import { MarkSvg } from './MarkSvg'

interface SimpleIcon {
  path: string
  hex: string
}

const BUNDLED: Partial<Record<SiteId, keyof typeof MARKS>> = {
  youtube: 'youtube',
  tiktok: 'tiktok',
  instagram: 'instagram',
  vimeo: 'vimeo',
  reddit: 'reddit',
  facebook: 'facebook',
  pinterest: 'pinterest',
}

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

function fillFor(hex: string): string {
  const n = parseInt(hex, 16)
  const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum < 0.12 ? 'currentColor' : `#${hex}`
}

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'id'> {
  site: SiteId
  size?: number
  labelled?: boolean
}

export function BrandMark({ site, size = 16, labelled = false, ...props }: BrandMarkProps) {
  const name = siteInfo(site).name
  const bundled = BUNDLED[site]
  if (bundled) return <MarkSvg mark={MARKS[bundled]} size={size} label={labelled ? name : undefined} {...props} />
  const icon = BRAND_MARKS[site]
  if (!icon) return null
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

export function LinkMark({ url, ...props }: Omit<BrandMarkProps, 'site'> & { url: string }) {
  const site = siteFor(url)
  return site ? <BrandMark site={site.id} {...props} /> : null
}

export function hasMark(url: string): boolean {
  const site = siteFor(url)
  return Boolean(site && BRAND_MARKS[site.id])
}
