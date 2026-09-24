// History and settings, kept in one SQLite file.
import { CONCURRENCY_MAX, CONCURRENCY_MIN, defaultSettings, type HistoryEntry, type HistoryQuery, type Job, type Settings } from '@sparky/core'
import Database from 'better-sqlite3'

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
}

export class Store {
  private db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
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
        `INSERT OR REPLACE INTO history (id, kind, title, source, outputs, status, error, size_before, size_after, duration_ms, finished_at, settings)
         VALUES (@id, @kind, @title, @source, @outputs, @status, @error, @size_before, @size_after, @duration_ms, @finished_at, @settings)`,
      )
      .run({
        id: job.id,
        kind: job.kind,
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
  return {
    id: r.id,
    kind: r.kind as HistoryEntry['kind'],
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
}

/** Keeps settings inside their allowed ranges even if the file was edited by hand. */
export function sanitize(s: Settings, base: Settings): Settings {
  const oneOf = <T,>(v: T, allowed: readonly T[], fallback: T) => (allowed.includes(v) ? v : fallback)
  return {
    ...s,
    outputRoot: typeof s.outputRoot === 'string' && s.outputRoot ? s.outputRoot : base.outputRoot,
    concurrency: Math.max(CONCURRENCY_MIN, Math.min(CONCURRENCY_MAX, Math.round(Number(s.concurrency) || base.concurrency))),
    performance: oneOf(s.performance, ['low', 'normal', 'max'] as const, base.performance),
    compression: oneOf(s.compression, [0, 1, 2, 3, 4] as const, base.compression),
    codec: oneOf(s.codec, ['h264', 'hevc', 'av1'] as const, base.codec),
    theme: oneOf(s.theme, ['system', 'light', 'dark'] as const, base.theme),
    downloadMode: oneOf(s.downloadMode, ['video', 'audio'] as const, base.downloadMode),
    dockHeight: Math.max(96, Math.min(600, Number(s.dockHeight) || base.dockHeight)),
  }
}
