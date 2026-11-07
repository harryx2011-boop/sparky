// Agent file reads over MCP: list, find and stat as short tab-separated text, run in this process, guarded like every other path.
import { findFiles, listFiles, statFiles, type FileEntry, type ListQuery, type StatResult } from '@sparky/engine'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { messageOf } from './errors'
import { checkInside } from './guard'
import { bytes } from './report'

const READ = { readOnlyHint: true, openWorldHint: false } as const

const FILTERS = {
  glob: { type: 'string', description: 'Name pattern such as *.pdf; with a slash it matches the path from `path` (one/*.pdf); ** crosses folders.' },
  ext: { type: 'array', items: { type: 'string' }, description: 'Extensions to keep, such as ["jpg","png"].' },
  kind: { type: 'string', enum: ['file', 'dir'] },
  minSize: { type: 'integer', minimum: 0, description: 'Bytes.' },
  maxSize: { type: 'integer', minimum: 0, description: 'Bytes.' },
  after: { type: 'string', description: 'Modified on or after this date, such as 2026-01-31.' },
  before: { type: 'string', description: 'Modified before this date.' },
  hidden: { type: 'boolean', description: 'Include hidden and system entries. Default false.' },
  limit: { type: 'integer', minimum: 1, description: 'Rows per answer. Default 200.' },
  cursor: { type: 'string', description: 'The value from a `more: cursor=` line, for the next rows.' },
} as const

export const FILE_TOOLS: Tool[] = [
  {
    name: 'sparky_files_list',
    description:
      'Lists a folder on this computer, faster and shorter than dir or Get-ChildItem. First line: counts, total size and top extensions of everything that matched. Then tab-separated rows `name size modified` (folders end in \\, sizes in bytes), names relative to `path`; a `more: cursor=N` line means more rows. Facts only, never file contents.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute folder path.' },
        depth: { type: 'integer', minimum: 1, description: 'Levels to go down; 1 (default) is the folder itself.' },
        ...FILTERS,
        sort: { type: 'string', enum: ['name', 'size', 'modified', 'type'], description: 'Default name, folders first.' },
        desc: { type: 'boolean' },
      },
      required: ['path'],
    },
    annotations: READ,
  },
  {
    name: 'sparky_files_find',
    description:
      'Finds files and folders by name under a folder, its whole tree by default; stops when a page is full. Give `glob` (*.mp4) or `text` (part of the name, any case). Answers like sparky_files_list without the totals. Junctions are not followed; folders it may not open are counted as skipped.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute folder to search under.' },
        text: { type: 'string', description: 'Part of the name, any case.' },
        depth: { type: 'integer', minimum: 1, description: 'Levels to search; the whole tree when left out.' },
        ...FILTERS,
      },
      required: ['path'],
    },
    annotations: READ,
  },
  {
    name: 'sparky_files_stat',
    description: 'Facts about many paths in one call: kind (file, dir, missing), size in bytes, modified time and flags (hidden, readonly, link). One tab-separated line per path.',
    inputSchema: {
      type: 'object',
      properties: { paths: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Absolute paths.' } },
      required: ['paths'],
    },
    annotations: READ,
  },
]

export const isFileTool = (name: string) => FILE_TOOLS.some((t) => t.name === name)

const pad = (n: number) => String(n).padStart(2, '0')

function when(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function row(e: FileEntry): string {
  const flags = [e.hidden && 'hidden', e.link && 'link'].filter(Boolean).join(',')
  const cells = [e.kind === 'dir' ? `${e.name}\\` : e.name, e.kind === 'dir' ? '' : String(e.size), when(e.mtime)]
  return (flags ? [...cells, flags] : cells).join('\t')
}

function statRow(s: StatResult): string {
  if (s.kind === 'missing') return `${s.path}\tmissing\t\t\t`
  const flags = [s.hidden && 'hidden', s.readonly && 'readonly', s.link && 'link'].filter(Boolean).join(',')
  return [s.path, s.kind, s.kind === 'dir' ? '' : String(s.size), when(s.mtime), flags].join('\t')
}

function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key]
  return typeof v === 'string' && v.trim() ? v : undefined
}

function num(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function query(input: Record<string, unknown>): ListQuery {
  const path = str(input, 'path')
  if (!path) throw new Error('Give `path`, an absolute folder.')
  const kind = input.kind === 'file' || input.kind === 'dir' ? input.kind : undefined
  const sort = ['name', 'size', 'modified', 'type'].includes(String(input.sort)) ? (input.sort as ListQuery['sort']) : undefined
  return {
    path,
    depth: num(input, 'depth'),
    glob: str(input, 'glob'),
    ext: Array.isArray(input.ext) ? input.ext.filter((x): x is string => typeof x === 'string') : undefined,
    kind,
    minSize: num(input, 'minSize'),
    maxSize: num(input, 'maxSize'),
    after: str(input, 'after'),
    before: str(input, 'before'),
    hidden: input.hidden === true,
    sort,
    desc: input.desc === true,
    limit: num(input, 'limit'),
    cursor: str(input, 'cursor'),
  }
}

const more = (next?: string) => (next ? [`more: cursor=${next}`] : [])

const HEADER = 'name\tsize\tmodified'

function run(name: string, input: Record<string, unknown>, roots: readonly string[]): string {
  if (name === 'sparky_files_stat') {
    const paths = Array.isArray(input.paths) ? input.paths.filter((p): p is string => typeof p === 'string' && p.length > 0) : []
    if (!paths.length) throw new Error('Give `paths`, a list of absolute paths.')
    checkInside(paths, roots)
    return ['path\tkind\tsize\tmodified\tflags', ...statFiles(paths).map(statRow)].join('\n')
  }
  const q = query(input)
  checkInside([q.path], roots)
  if (name === 'sparky_files_find') {
    const r = findFiles({ ...q, text: str(input, 'text'), depth: q.depth })
    const skipped = r.skipped ? ` ${plural(r.skipped, 'folder', 'folders')} skipped (no access).` : ''
    return [`${plural(r.entries.length, 'match', 'matches')} under ${r.path}.${skipped}`, HEADER, ...r.entries.map(row), ...more(r.next)].join('\n')
  }
  const r = listFiles(q)
  const { files, dirs, exts } = r.summary
  const total = files + dirs
  const start = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0
  const top = exts.length ? ` (${exts.map(([x, n]) => `${x} ${n}`).join(', ')})` : ''
  const rows = r.entries.length ? ` Rows ${start + 1}-${start + r.entries.length} of ${total}.` : ''
  const skipped = r.skipped ? ` ${plural(r.skipped, 'folder', 'folders')} skipped (no access).` : ''
  const head = `${r.path}: ${plural(files, 'file', 'files')}, ${plural(dirs, 'folder', 'folders')}, ${bytes(r.summary.bytes)}${top}.${rows}${skipped}`
  return [head, HEADER, ...r.entries.map(row), ...more(r.next)].join('\n')
}

export function callFileTool(name: string, input: Record<string, unknown>, roots: readonly string[]): CallToolResult {
  try {
    return { content: [{ type: 'text', text: run(name, input, roots) }] }
  } catch (e) {
    return { content: [{ type: 'text', text: messageOf(e) }], isError: true }
  }
}
