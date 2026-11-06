# 0001: File operations are engine ops

Status: Proposed   ·   Date: 2026-11-05   ·   Plan: `docs/plans/2026-11-05-sparky-2-file-manager.md`

## Context
Sparky 2.0 becomes a file manager (D-2.0-1). It needs copy, move, rename, delete, mkdir, batch rename, extract and pack. Sparky already has one op registry (`packages/engine/src/ops/`) that drives the Queue, History, the CLI, the HTTP API and the MCP server. Rival file managers keep file transfers in a separate queue from any media tools; none lets an agent call the same actions the window uses (research report, `D:\sparky\reports\Sparky file manager remap.md`).

## Decision
Each file action is an op in the registry (`file.copy`, `file.move`, `file.rename`, `file.delete`, `file.mkdir`, `file.batch_rename`, `archive.extract`, `archive.pack`), validated with zod like the others, run by the queue and recorded in History. Each op writes reverse steps to an undo journal in the history DB. Batches over 20 files return a planned-result preview before they run. Agent surfaces expose them only in the `all` MCP profile, behind `guard.ts`; for agents, delete is Recycle Bin only.

## Consequences
- The Queue, CLI, API and MCP get file actions with no extra surface code.
- Small actions (rename one file) pay queue overhead; the queue must run them with no visible delay, so ops marked `instant` skip the job card.
- A bug in these ops can lose files, so each op ships with temp-folder tests for success, conflict, cancel and full disk before it is exposed.
- The window accepts UNC and `\\?\` paths while agent surfaces keep refusing them.
