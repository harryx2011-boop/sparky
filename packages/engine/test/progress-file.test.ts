import type { Job } from "@sparky/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProgressWriter } from "../src/progress-file";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "sparky-progress-"));
const settle = () => new Promise((r) => setTimeout(r, 50));
const job = (over: Partial<Job> = {}): Job => ({
  id: "abcdef12-0000-0000-0000-000000000000",
  kind: "convert",
  op: "convert",
  title: "clip.mov",
  source: "clip.mov",
  status: "running",
  progress: 0.25,
  outputs: [],
  createdAt: 0,
  ...over,
});
const read = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, "sparky-abcdef12.json"), "utf8"));

describe("progress file writer", () => {
  it("writes the contract file for a running job", async () => {
    const dir = tmp();
    createProgressWriter({ dir })([
      job({ stage: { index: 1, count: 2, label: "Encoding" } }),
    ]);
    await settle();
    const f = read(dir);
    expect(f).toMatchObject({
      id: "sparky-abcdef12",
      label: "Sparky \u00b7 clip.mov",
      kind: "other",
      step: "Encoding",
      pct: 25,
      state: "running",
    });
    expect(Date.parse(f.startedAt)).toBeGreaterThan(0);
    expect(fs.readdirSync(dir)).toEqual(["sparky-abcdef12.json"]);
  });

  it("maps kind: download, media tools, and unknown progress", async () => {
    const dir = tmp();
    const report = createProgressWriter({ dir });
    report([job({ kind: "download", op: "download", progress: -1 })]);
    await settle();
    expect(read(dir)).toMatchObject({ kind: "download", pct: null });
    const dir2 = tmp();
    createProgressWriter({ dir: dir2 })([
      job({ kind: "tool", op: "media.compress" }),
    ]);
    await settle();
    expect(read(dir2).kind).toBe("render");
  });

  it("throttles running writes but always writes the end", async () => {
    const dir = tmp();
    let t = 1000;
    const report = createProgressWriter({ dir, now: () => t });
    report([job({ progress: 0.1 })]);
    t += 50;
    report([job({ progress: 0.2 })]);
    await settle();
    expect(read(dir).pct).toBe(10);
    t += 1;
    report([job({ status: "done", progress: 1 })]);
    await settle();
    expect(read(dir)).toMatchObject({ state: "done", pct: 100 });
  });

  it("ends failed and canceled jobs as failed, once, and ignores queued ones", async () => {
    for (const [status, step] of [
      ["failed", "failed"],
      ["canceled", "canceled"],
    ] as const) {
      const dir = tmp();
      const report = createProgressWriter({ dir });
      report([job({ status: "queued" })]);
      await settle();
      expect(fs.readdirSync(dir)).toEqual([]);
      report([job()]);
      report([job({ status })]);
      report([job({ status })]);
      await settle();
      expect(read(dir)).toMatchObject({ state: "failed", step });
    }
  });

  it("removes the file when a job is paused", async () => {
    const dir = tmp();
    const report = createProgressWriter({ dir });
    report([job()]);
    await settle();
    report([job({ status: "paused" })]);
    await settle();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("is silent when off, and never throws on an unwritable folder", async () => {
    const dir = tmp();
    createProgressWriter({ dir, enabled: false })([job()]);
    await settle();
    expect(fs.readdirSync(dir)).toEqual([]);
    const blocked = path.join(dir, "file");
    fs.writeFileSync(blocked, "x");
    expect(() =>
      createProgressWriter({ dir: path.join(blocked, "sub") })([job()]),
    ).not.toThrow();
    await settle();
  });
});
