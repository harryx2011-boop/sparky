// History and settings, kept in one SQLite file.
import { defaultSettings, type HistoryEntry, type HistoryQuery, type Job, type Settings } from '@sparky/core'
import Database from 'better-sqlite3'
import { opById } from './ops'

interface HistoryRow {
  id: string
  kind: string
  title: string
  source: string
  outputs: string
  status: string
  error: string | null
  size_before: number | null
  size_after: number | null
  duration_ms: number
  finished_at: number
  settings: string | null
  op: string | null
  args: string | null
}

/** Schema changes in order; PRAGMA user_version counts how many have run. Append only. */
const MIGRATIONS = [
  `ALTER TABLE history ADD COLUMN op TEXT;
   ALTER TABLE history ADD COLUMN args TEXT;
   CREATE INDEX IF NOT EXISTS history_op ON history (op);`,
]

export class Store {
  private db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
    // The app and the CLI can share this file.
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        outputs TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        size_before INTEGER,
        size_after INTEGER,
        duration_ms INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        settings TEXT
      );
      CREATE INDEX IF NOT EXISTS history_finished ON history (finished_at DESC);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `)
    this.migrate()
  }

  private migrate(): void {
    const version = () => this.db.pragma('user_version', { simple: true }) as number
    if (version() >= MIGRATIONS.length) return
    // IMMEDIATE takes the write lock before reading the version, so two processes never run the same step twice.
    this.db
      .transaction(() => {
        for (const sql of MIGRATIONS.slice(version())) this.db.exec(sql)
        this.db.pragma(`user_version = ${MIGRATIONS.length}`)
      })
      .immediate()
  }

  close(): void {
    this.db.close()
  }

  // ---------- History ----------

  record(job: Job): void {
    if (job.status !== 'done' && job.status !== 'failed' && job.status !== 'canceled') return
    const settings = job.convert ? { convert: job.convert } : job.download ? { download: job.download } : null
    this.db
      .prepare(
        `INSERT OR REPLACE INTO history (id, kind, op, title, source, outputs, status, error, size_before, size_after, duration_ms, finished_at, settings, args)
         VALUES (@id, @kind, @op, @title, @source, @outputs, @status, @error, @size_before, @size_after, @duration_ms, @finished_at, @settings, @args)`,
      )
      .run({
        id: job.id,
        kind: job.kind,
        op: job.op,
        title: job.title,
        source: job.source,
        outputs: JSON.stringify(job.outputs),
        status: job.status,
        error: job.error ?? null,
        size_before: job.sizeBefore ?? null,
        size_after: job.sizeAfter ?? null,
        duration_ms: job.startedAt && job.finishedAt ? job.finishedAt - job.startedAt : 0,
        finished_at: job.finishedAt ?? Date.now(),
        settings: settings ? JSON.stringify(settings) : null,
        args: job.args === undefined ? null : JSON.stringify(job.args),
      })
  }

  search(q: HistoryQuery = {}): HistoryEntry[] {
    const where: string[] = []
    const params: Record<string, unknown> = { limit: Math.min(Math.max(q.limit ?? 200, 1), 1000) }
    if (q.text?.trim()) {
      where.push(`(title LIKE @text ESCAPE '\\' OR source LIKE @text ESCAPE '\\' OR outputs LIKE @text ESCAPE '\\')`)
      params.text = `%${q.text.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    }
    if (q.kind && q.kind !== 'all') {
      where.push('kind = @kind')
      params.kind = q.kind
    }
    if (q.status && q.status !== 'all') {
      where.push('status = @status')
      params.status = q.status
    }
    const rows = this.db
      .prepare(`SELECT * FROM history ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY finished_at DESC LIMIT @limit`)
      .all(params) as HistoryRow[]
    return rows.map(toEntry)
  }

  get(id: string): HistoryEntry | undefined {
    const row = this.db.prepare('SELECT * FROM history WHERE id = ?').get(id) as HistoryRow | undefined
    return row ? toEntry(row) : undefined
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM history WHERE id = ?').run(id)
  }

  clear(): void {
    this.db.exec('DELETE FROM history')
  }

  // ---------- Settings ----------

  loadSettings(defaultRoot: string): Settings {
    const base = defaultSettings(defaultRoot)
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const saved: Record<string, unknown> = {}
    for (const r of rows) {
      try {
        saved[r.key] = JSON.parse(r.value)
      } catch {
        /* ignore a corrupt value and fall back to the default */
      }
    }
    // Older versions stored a "jobs at once" number; one meant "one at a time", anything more meant batch.
    if (typeof saved.batch !== 'boolean' && typeof saved.concurrency === 'number') saved.batch = saved.concurrency > 1
    return sanitize({ ...base, ...saved, downloadExtras: { ...base.downloadExtras, ...(saved.downloadExtras as object | undefined) } }, base)
  }

  saveSettings(patch: Partial<Settings>): void {
    const put = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const tx = this.db.transaction((entries: [string, unknown][]) => {
      for (const [k, v] of entries) put.run(k, JSON.stringify(v))
    })
    tx(Object.entries(patch).filter(([, v]) => v !== undefined))
  }
}

function toEntry(r: HistoryRow): HistoryEntry {
  const settings = r.settings ? (JSON.parse(r.settings) as Pick<HistoryEntry, 'convert' | 'download'>) : {}
  const entry: HistoryEntry = {
    id: r.id,
    kind: r.kind as HistoryEntry['kind'],
    op: r.op ?? r.kind,
    title: r.title,
    source: r.source,
    outputs: JSON.parse(r.outputs) as string[],
    status: r.status as HistoryEntry['status'],
    error: r.error ?? undefined,
    sizeBefore: r.size_before ?? undefined,
    sizeAfter: r.size_after ?? undefined,
    durationMs: r.duration_ms,
    finishedAt: r.finished_at,
    ...settings,
  }
  // Rows from before ops kept only their convert or download block; the op rebuilds its input from that.
  try {
    entry.args = r.args ? (JSON.parse(r.args) as unknown) : opById(entry.op)?.fromHistory?.(entry)
  } catch {
    /* a malformed row still lists; it just can't be run again */
  }
  return entry
}

/** Keeps settings within their allowed ranges even if the file was edited by hand. */
export function sanitize(s: Settings, base: Settings): Settings {
  const oneOf = <T,>(v: T, allowed: readonly T[], fallback: T) => (allowed.includes(v) ? v : fallback)
  return {
    ...s,
    outputRoot: typeof s.outputRoot === 'string' && s.outputRoot ? s.outputRoot : base.outputRoot,
    batch: typeof s.batch === 'boolean' ? s.batch : base.batch,
    performance: oneOf(s.performance, ['low', 'normal', 'max'] as const, base.performance),
    compression: oneOf(s.compression, [0, 1, 2, 3, 4] as const, base.compression),
    codec: oneOf(s.codec, ['h264', 'hevc', 'av1'] as const, base.codec),
    theme: oneOf(s.theme, ['system', 'light', 'dark'] as const, base.theme),
    downloadMode: oneOf(s.downloadMode, ['video', 'audio'] as const, base.downloadMode),
    dockHeight: Math.max(96, Math.min(600, Number(s.dockHeight) || base.dockHeight)),
  }
}
