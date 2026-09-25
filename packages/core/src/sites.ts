// Sites Sparky recognises by name. One row per site; the UI keeps each one's mark under the same id.
// Any other link can still be pasted by hand.

export type SiteId =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'vimeo'
  | 'soundcloud'
  | 'twitch'
  | 'reddit'
  | 'facebook'
  | 'dailymotion'
  | 'bandcamp'
  | 'bilibili'
  | 'kick'
  | 'rumble'
  | 'streamable'
  | 'archive'
  | 'niconico'
  | 'mixcloud'
  | 'bluesky'
  | 'threads'
  | 'pinterest'
  | 'vk'
  | 'odysee'
  | 'ted'
  | 'nebula'
  | 'bitchute'
  | 'imgur'
  | 'tumblr'
  | 'loom'

export interface Site {
  id: SiteId
  name: string
  /** Bare hosts; subdomains such as www., m. and music. match too. */
  hosts: readonly string[]
}

export const SITES: readonly Site[] = [
  { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', name: 'TikTok', hosts: ['tiktok.com'] },
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com'] },
  { id: 'x', name: 'X', hosts: ['x.com', 'twitter.com'] },
  { id: 'vimeo', name: 'Vimeo', hosts: ['vimeo.com'] },
  { id: 'soundcloud', name: 'SoundCloud', hosts: ['soundcloud.com'] },
  { id: 'twitch', name: 'Twitch', hosts: ['twitch.tv'] },
  { id: 'reddit', name: 'Reddit', hosts: ['reddit.com'] },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'fb.watch'] },
  { id: 'dailymotion', name: 'Dailymotion', hosts: ['dailymotion.com'] },
  { id: 'bandcamp', name: 'Bandcamp', hosts: ['bandcamp.com'] },
  { id: 'bilibili', name: 'Bilibili', hosts: ['bilibili.com'] },
  { id: 'kick', name: 'Kick', hosts: ['kick.com'] },
  { id: 'rumble', name: 'Rumble', hosts: ['rumble.com'] },
  { id: 'streamable', name: 'Streamable', hosts: ['streamable.com'] },
  { id: 'archive', name: 'Internet Archive', hosts: ['archive.org'] },
  { id: 'niconico', name: 'Niconico', hosts: ['nicovideo.jp'] },
  { id: 'mixcloud', name: 'Mixcloud', hosts: ['mixcloud.com'] },
  { id: 'bluesky', name: 'Bluesky', hosts: ['bsky.app'] },
  { id: 'threads', name: 'Threads', hosts: ['threads.net'] },
  { id: 'pinterest', name: 'Pinterest', hosts: ['pinterest.com'] },
  { id: 'vk', name: 'VK', hosts: ['vk.com'] },
  { id: 'odysee', name: 'Odysee', hosts: ['odysee.com'] },
  { id: 'ted', name: 'TED', hosts: ['ted.com'] },
  { id: 'nebula', name: 'Nebula', hosts: ['nebula.tv'] },
  { id: 'bitchute', name: 'BitChute', hosts: ['bitchute.com'] },
  { id: 'imgur', name: 'Imgur', hosts: ['imgur.com'] },
  { id: 'tumblr', name: 'Tumblr', hosts: ['tumblr.com'] },
  { id: 'loom', name: 'Loom', hosts: ['loom.com'] },
]

/** The site a full http(s) link points at, if Sparky knows it by name. */
export function siteFor(url: string): Site | undefined {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
  return SITES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
}

export function siteInfo(id: SiteId): Site {
  return SITES.find((s) => s.id === id)!
}
