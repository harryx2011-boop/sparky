// Picks the window material: Windows 11 22H2+ gets the OS acrylic behind a clear wall, everything else the painted Frost wall.
export type WindowMaterial = 'os' | 'none'

const FIRST_ACRYLIC_BUILD = 22621

export function windowMaterial(platform: string, release: string, forced: string | undefined): WindowMaterial {
  if (forced === 'none' || platform !== 'win32') return 'none'
  return Number(release.split('.')[2]) >= FIRST_ACRYLIC_BUILD ? 'os' : 'none'
}
