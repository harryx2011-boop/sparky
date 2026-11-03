// Mirrors running jobs into ~/.claude/state/progress/<id>.json so the QoL VS Code progress bar can show them.
import type { Job } from "@sparky/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ProgressWriterOptions {
  dir?: string;
  now?: () => number;
  intervalMs?: number;
  enabled?: boolean;
}

interface Seen {
  startedAt: number;
  lastWrite: number;
  ended: boolean;
}

const defaultDir = () =>
  process.env.SPARKY_PROGRESS_DIR ||
  path.join(os.homedir(), ".claude", "state", "progress");

const fileKind = (job: Job) =>
  job.kind === "download"
    ? "download"
    : job.op.startsWith("media.")
      ? "render"
      : "other";

const fileId = (job: Job) =>
  `sparky-${job.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8)}`;

export function createProgressWriter({
  dir,
  now = Date.now,
  intervalMs = 250,
  enabled = process.env.SPARKY_PROGRESS_FILE !== "0",
}: ProgressWriterOptions = {}) {
  if (!enabled || (!dir && process.env.NODE_ENV === "test"))
    return (_jobs: readonly Job[]) => {};
  const folder = dir ?? defaultDir();
  const seen = new Map<string, Seen>();

  const report = (job: Job) => {
    const id = fileId(job);
    const t = now();
    const mem = seen.get(job.id) ?? {
      startedAt: t,
      lastWrite: -Infinity,
      ended: false,
    };
    seen.set(job.id, mem);

    if (job.status === "paused") return remove(folder, id);
    if (job.status === "queued") return;
    const running = job.status === "running";
    if (running) {
      mem.ended = false;
      if (t - mem.lastWrite < intervalMs) return;
    } else {
      if (mem.ended) return;
      mem.ended = true;
    }
    mem.lastWrite = t;
    write(folder, id, {
      id,
      label: `Sparky \u00b7 ${job.title}`,
      kind: fileKind(job),
      step: running ? (job.stage?.label ?? "working") : job.status,
      pct:
        job.status === "done"
          ? 100
          : job.progress >= 0
            ? Math.round(job.progress * 100)
            : null,
      state: running ? "running" : job.status === "done" ? "done" : "failed",
      startedAt: new Date(job.startedAt ?? mem.startedAt).toISOString(),
      updatedAt: new Date(t).toISOString(),
    });
  };

  return (jobs: readonly Job[]) => {
    try {
      for (const job of jobs) report(job);
      const live = new Set(jobs.map((j) => j.id));
      for (const id of seen.keys()) if (!live.has(id)) seen.delete(id);
    } catch {
    }
  };
}

function write(folder: string, id: string, body: object): void {
  try {
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `${id}.json`);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(body, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  } catch {
  }
}

function remove(folder: string, id: string): void {
  try {
    fs.rmSync(path.join(folder, `${id}.json`), { force: true });
  } catch {
  }
}
