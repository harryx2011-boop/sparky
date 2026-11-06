// One folder listing, column by column; row i of every array is the same entry.

export interface Listing {
  names: string[]
  kinds: Uint8Array
  sizes: Float64Array
  mtimes: Float64Array
  ctimes: Float64Array
  attrs: Uint32Array
}

export type ListErrorCode = 'EACCES' | 'ENOENT' | 'ENOTDIR' | 'EIO'
