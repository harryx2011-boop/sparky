Status: PLANNED

# Sparky 2.0: agent files

**Goal:** make Sparky the way agents work with files on this PC: fast, token-lean read tools, safe undoable write tools and a window the agent can point at, all through the Sparky MCP server and built on the same engine ops the UI will use.

Parent plan: `2026-11-05-sparky-2-file-manager.md`. This plan runs before its step 12 and absorbs its steps 15, 16, 17 and 19.

## Decisions (Harry, 2026-11-07)

| ID | Question | Answer |
|---|---|---|
| D-2.0-9 | Order | Agent file tools next, on `sparky-2`; the UI steps 12-14 follow and reuse the same ops. Ships with 2.0, not as a 1.4 |
| D-2.0-10 | What agents get back | Facts only: names, kinds, sizes, dates, types, counts. No file contents, no peeks (no text heads, image sizes, page counts). Sparky still returns paths, never bytes |
| D-2.0-11 | Writes | Copy, move, rename, new folder and delete are in the default `core` profile. Delete only goes to the Recycle Bin. Every change is journaled and can be undone |
| D-2.0-12 | Window role | Two-way: an Agents place lists what agents looked at and changed (Undo on each change), and agents can open a folder and select files in the window, or read what Harry has selected |

Defaults I picked (change any before its step starts):

- **Token-lean text, not JSON rows.** Listings come back as one summary line, then one tab-separated row per entry with names relative to the listed folder (`name  kind  size  modified`), then a `more: <cursor>` line. Sizes in bytes, dates as `YYYY-MM-DD HH:MM` local. Measured against `Get-ChildItem` in step A4.
- **Few tools.** Reads are three tools (`sparky_files_list`, `sparky_files_find`, `sparky_files_stat`); the folder summary is the first line of every list, not a fourth tool. Every tool schema costs every agent context, so a test caps the `core` tools/list size.
- **One job per write call.** File ops use `arity: 'all'`: one call that moves 50 files is one job, one Queue row and one undo group.
- **`dryRun` on every write.** Returns the planned result (what lands where, which names clash) without touching disk. This is the agent half of the parent plan's step 18.
- **Conflicts default to `fail`.** An agent cannot answer a prompt. Choices: `fail`, `skip`, `keep-both`, `replace`; `replace` sends the old file to the Recycle Bin first, so undo can bring it back.
- **Undo checks fingerprints.** Undo refuses an entry whose file changed since (size or modified time differ) and says which one.
- **The window does not steal focus.** `sparky_show` opens the folder in Browse, selects the names and flashes the taskbar button.
- **Reads are logged in memory only** (last 200, for the Agents place); writes are in the history database.
- **No caps** on counts or sizes (memory `no-limits-local`); a `limit` and `cursor` page long answers instead.

## Out of scope

File contents or previews for agents (D-2.0-10), permanent delete for agents, the Everything SDK and the FTS5 index (parent step 22 plugs in behind `files.find`), batch rename, archives, cloud and network paths for agents (the guard keeps refusing UNC), the window's own Ctrl+Z and preview table (UI work in the parent plan).

## Steps

Each step is one commit on `sparky-2`. Verify commands run from `D:\sparky\sparky`; long suites run in the background. Engine tests that need tools use `SPARKY_TEST_BIN=D:/sparky/sparky/apps/desktop/resources/bin`.

### A1. Spec and decisions (docs only)

New "Agents" section in `docs/specs/file-manager.md` with scenarios S34 onward (list, find, stat, the guard, each write op, dry run, conflicts, undo, show, selection, the Agents place); S16 rewritten for the `core` profile. D-2.0-9 to 12 in `DECISIONS.md`. The parent plan points here. Verify: each new scenario has a row in the spec's test map.

### A2. Engine `files` read module

`packages/engine/src/files/`: `list` (depth, glob, extension and kind filters, size and date ranges, hidden on/off, sort, `limit` and `cursor`), `stat` (many paths in one call: exists, kind, size, dates, attributes, extension; agents read the extension, so no Explorer-style type label) and the summary (counts by kind, total size, top extensions). Works on a `Lister` seam: `@sparky/fs-native` when it loads, Node `fs` otherwise with one logged warning (closes the open item from parent step 6). The engine gains the `@sparky/fs-native` dependency. Verify: `npm test -w @sparky/engine -- files` on temp folders. **Done 2026-11-07:** `packages/engine/src/files/` (`list.ts`, `stat.ts`, `glob.ts`, `lister.ts`, `types.ts`), exported from the engine index. Name sort is natural with folders first; the summary covers everything that matched, not just the page; the cursor is the next offset; hidden and system entries are left out unless `hidden: true`; links are never walked into. Tests `test/files.test.ts` (S34-S36 plus filters, glob with a slash, missing folder, drive root): 7 pass; typecheck clean. Real folders: `Downloads` (541 entries, 13.9 GB) in 16 ms with the native lister; `System32` to depth 3 for `*.dll` in 321 ms (3,956 matches, 17 folders skipped as blocked); `C:\pagefile.sys` reads as hidden. Engine suite: 377 pass, 2 fail, both PDF OCR tests that also fail without this change (ROADMAP open item). Gap for A3: the Node `fs` fallback does not mark junctions as links, so a fallback walk could loop.

### A3. `files.find`

Name search under a folder: glob or plain text, the same filters as `list`, stops at `limit` and hands back a cursor, never follows junctions or symlinks into loops, skips folders it cannot open and counts them. Verify: engine tests (a junction loop fixture, a blocked folder); print the time to find `*.mp4` under `D:\` once, in the step note. **Done 2026-11-07:** `src/files/find.ts` (`findFiles`: `glob` or `text`, the list filters, whole tree by default, stops when the page is full, offset cursor); `walk` now takes a visitor that can stop it. The fs-native Node fallback now marks junctions and symlinks as folders with the reparse flag (it read them as files before, so a fallback walk could loop); test in `packages/fs-native/test/list.test.ts`. Tests: engine `files.test.ts` 10 pass (S37 with a real junction loop and a refused folder), fs-native 12 pass, 1 skipped (UNC); typechecks clean. Timing: a find for `*.mp4` from `D:\` did not answer within 4-5 minutes on this busy PC (two tries), because a walk with no index reads the whole drive until the page fills. Open: give find a time budget (answer with what it has plus "stopped after N s") and lean on the search index (parent step 22) for drive-wide finds.

### A4. MCP read tools

`sparky_files_list`, `sparky_files_find`, `sparky_files_stat` in `packages/cli/src/mcp.ts` (read-only hints), `Backend.files` in both backends, routes `POST /v1/files/list|find|stat` in the route table. Every path goes through `guard.ts` first. Output in the token-lean text format above. Verify: `npm test -w @sparky-labs/cli` (stdio test lists a temp folder; `mcp-limits` refuses a path outside the roots); `node scripts/bench-agent-list.mjs` prints characters for Sparky's list of `Downloads` versus `Get-ChildItem | Format-Table`, numbers recorded here. **Done 2026-11-07, smaller than planned:** reads run inside the MCP server process (`packages/cli/src/mcp-files.ts`) instead of through `Backend` and new HTTP routes: they need no queue, skip a hop and work with the app closed. A11 will report reads to the app when the Agents place exists. `FILE_TOOLS` join every profile; `callTool` hands them to `callFileTool` first. `guard.ts` gained `checkInside(paths, roots)`, shared with `checkPaths`. Output: one summary line (`<path>: N files, N folders, size (top extensions). Rows a-b of n.`), a `name size modified` header, tab-separated rows (folders end in `\`, sizes in bytes, local `YYYY-MM-DD HH:MM`, a flags cell only when hidden or link), `more: cursor=N`; stat is `path kind size modified flags`. The server instructions name the three tools. Tests: `packages/cli/test/mcp-files.test.ts` (S34-S38 output and guard, 7 pass), `mcp.test.ts` tool lists updated; CLI MCP suites 31 pass; typecheck clean. Not done: the bench script (the character count against `Get-ChildItem` was started but not recorded before the session closed).

### A5. Recycle Bin in `fs-native`

`trash(paths)` through `IFileOperation` with recycle-on-delete, so the CLI's local mode can trash without Electron; it refuses a volume with no Recycle Bin (checked with `SHQueryRecycleBin`) instead of deleting for good. `restore(originalPath, deletedAfter)` finds the item in the Recycle Bin shell folder by its original path and delete time and moves it back. Spike first: if restore is not reliable, undo of a trash says "Restore it from the Recycle Bin" and opens the bin, and the step note says so. Verify: `npm test -w @sparky/fs-native` (trash a temp file, restore it, bytes equal; a no-bin volume is refused).

### A6. Ops `file.mkdir` and `file.rename`

In `packages/engine/src/ops/file.ts`, registered in `OPS`. `dryRun`, conflict policy, each writes its undo steps (A8 stores them; until then they are returned in the result). Verify: engine tests (S-numbers from A1): clash under each policy, dry run touches nothing.

### A7. Ops `file.copy` and `file.move`

Progress and cancel (a cancelled copy leaves no partial file), same-volume move is a rename, cross-volume move is copy then trash of the source, `replace` trashes the old target first. Verify: engine tests, including cancel mid-copy of a 200 MB temp file.

### A8. Op `file.trash` and the undo journal

`file.trash` uses the host's `trash` (Electron) or `fs-native` (local). New `undo` table in the history database (`PRAGMA user_version` bump) keyed by job id: reverse steps plus fingerprints. `engine.undo(jobId)` runs them in reverse order and refuses changed files by name. Verify: engine tests for undo of mkdir, rename, copy, move and trash; a changed file is refused; a 1.3.0 database migrates.

### A9. Writes for agents

`file.*` ops join `CORE_OPS` in `profiles.ts`; `sparky_undo { job? }` (default: this client's last change); jobs carry who ran them (`by: { surface, client }`, the client name from the MCP `initialize` request). Tool descriptions say "trash, not delete" and "dryRun first for big batches". A test caps the `core` tools/list size (measure first, cap at today's size plus the new tools). Verify: CLI tests (a move then `sparky_undo` through stdio; a move outside the roots is refused); `npm run check` in the background.

### A10. Two-way window

While the app hosts the API, it registers `POST /v1/ui/show { path, select? }` and `GET /v1/ui/selection`; MCP `sparky_show` and `sparky_selection` call them, and in local mode answer "Open the Sparky window to use this." `show` opens Browse at the folder (pushes history, so Back returns), selects the names and flashes the taskbar. `selection` returns the open folder and the selected paths, guarded like every other path. Verify: desktop tests for both handlers; drive the built app over DevTools: `sparky_show` with 3 names shows the folder with "3 selected".

### A11. Agents place

Load the `website-design` skill first. A Places entry "Agents" (below Queue and History): each row is client, time, what it did (listed `D:\x`, moved 12 files), with Undo on writes and a click that opens the folder. Reads come from the in-memory log, writes from history. Verify: desktop tests; DevTools drive: an agent move shows a row, Undo puts the files back; screenshots `docs/design/2.0/shots/agents-*.png` looked at by eye.

### A12. Docs and the harness

`context.md`, the server instructions in `mcp.ts`, the parent plan (steps 15-17 and 19 marked absorbed), and outside the repo the `sparky` skill and the `mcp-route` row so agents reach for Sparky's file tools. Rebuild the installed app with `node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky` and call each new tool once through Claude Code. Verify: the live calls' output in the step note.

## Risks and rollback

- **Agents can now change files by default (D-2.0-11).** Mitigations: the path guard (roots `D:\` and `Downloads\Sparky` on this PC), trash-only delete, `replace` trashes first, `dryRun`, fingerprinted undo, temp-folder tests for every op including cancel. Rollback: drop the `file.*` ids from `CORE_OPS` (one line); they stay in the `all` profile.
- **Silent permanent delete.** `IFileOperation` deletes for good on a volume with no Recycle Bin. A5 refuses those volumes; a test covers it.
- **Recycle Bin restore is fragile** (shell folder columns, two items with the same name). The A5 spike decides; the fallback is stated there.
- **Tool count.** Ten new tools in `core` cost every agent context on connect. The tools/list cap in A9 keeps it measured; trim descriptions before cutting tools.
- **Native addon in the CLI.** The shim runs `Sparky.exe` as Node with `NODE_PATH` at the app's modules; if the addon does not load there, the Node `fs` fallback runs and logs once. A12's live calls check which one ran.
- **Rollback overall.** Every step is a commit on `sparky-2`; `main` keeps 1.3.0.
