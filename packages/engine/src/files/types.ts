// Shapes for agent file reads: facts about files, never their contents (D-2.0-10).

export type EntryKind = 'file' | 'dir'

export type SortKey = 'name' | 'size' | 'modified' | 'type'

export interface FileEntry {
  name: string
  kind: EntryKind
  size: number
  mtime: number
  ctime: number
  hidden: boolean
  link: boolean
}

export interface ListQuery {
  path: string
  depth?: number
  glob?: string
  ext?: string[]
  kind?: EntryKind
  minSize?: number
  maxSize?: number
  after?: string | number
  before?: string | number
  hidden?: boolean
  sort?: SortKey
  desc?: boolean
  limit?: number
  cursor?: string
}

export interface FolderSummary {
  files: number
  dirs: number
  bytes: number
  exts: [string, number][]
}

export interface ListResult {
  path: string
  summary: FolderSummary
  entries: FileEntry[]
  next?: string
  skipped: number
}

export interface FindQuery extends Omit<ListQuery, 'sort' | 'desc'> {
  text?: string
}

export interface FindResult {
  path: string
  entries: FileEntry[]
  next?: string
  skipped: number
}

export type StatResult =
  | { path: string; kind: 'missing' }
  | { path: string; kind: EntryKind; size: number; mtime: number; ctime: number; ext: string; hidden: boolean; readonly: boolean; link: boolean }
