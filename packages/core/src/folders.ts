// Folder listing shapes shared by the main process and the window: one column per field, rows by index.
export interface FolderListing {
  names: string[]
  kinds: Uint8Array
  sizes: Float64Array
  mtimes: Float64Array
  ctimes: Float64Array
  attrs: Uint32Array
}

export type FolderListResult =
  | { ok: true; path: string; head: FolderListing; total: number; rest: string | null }
  | { ok: false; path: string; code: string; message: string }
