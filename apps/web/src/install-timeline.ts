/** The download page's install sequence: each beat is one state of getting Sparky, played once and held on the last. */
export type Beat = 'download' | 'install' | 'launch' | 'convert' | 'done'

export const BEATS: readonly { beat: Beat; at: number }[] = [
  { beat: 'download', at: 0 },
  { beat: 'install', at: 1700 },
  { beat: 'launch', at: 3500 },
  { beat: 'convert', at: 6300 },
  { beat: 'done', at: 7800 },
]

export const FINAL: Beat = 'done'

/** How long each progress bar takes to fill, in seconds. */
export const FILL = { download: 1.3, install: 1.35, convert: 1.15 } as const

export function reached(current: Beat | null, beat: Beat): boolean {
  if (!current) return false
  return BEATS.findIndex((b) => b.beat === current) >= BEATS.findIndex((b) => b.beat === beat)
}
