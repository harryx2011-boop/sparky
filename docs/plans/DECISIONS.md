Status: IN PROGRESS

# Sparky decisions

Owner answers, verbatim from repo docs. IDs are stable. A later change gets a new ID that names the one it replaces.

## Sparky 1.1 plan, the 20 answers (2026-09-25)

Source: `archive/2026-09-25-sparky-1.1-agents-utilities.md`, section "Decisions (the 20 answers)".

| ID | Question | Decision |
|---|---|---|
| D-1.1-1 | Engine home | Both: `packages/engine` shared package, and the running app hosts the HTTP API; CLI and MCP fall back to running the engine in-process when the app is closed |
| D-1.1-2 | Agent surfaces | MCP over stdio, local HTTP API, CLI. No MCP-over-HTTP |
| D-1.1-3 | Local auth | Token file in app data (`%APPDATA%\Sparky\api-token`), loopback only |
| D-1.1-4 | "Built-in tools" group | Removed from its place in Settings; tool status rows and the downloader update button move into a new **Diagnostics** group |
| D-1.1-5 | Utility families | PDF toolkit, Helix data documents, media editing ops, image editing ops |
| D-1.1-6 | Office formats | Detect LibreOffice (already an optional tool); targets light up when `soffice` is found |
| D-1.1-7 | OCR / ebook | OCR via `tesseract.js` (English bundled, other languages on demand). No ebook this round |
| D-1.1-8 | Version | 1.1.0 target; final level from the diff |
| D-1.1-9 | Icon source | Windows association first (`app.getFileIcon`), bundled fallback |
| D-1.1-10 | Fallback pack | VS Code icons (`vscode-icons`, MIT). Built as a portable unit so Cortex and Helix can adopt it. Noted (Luminous) keeps its own badges |
| D-1.1-11 | Icon placement | Convert file rows, format picker targets, queue/dock/history rows. Sidebar keeps lucide |
| D-1.1-12 | Helix boundary | Remove everything named convert: browser converter, `/v1/convert`, `helix_convert`, extract's `convert.py`, tests, OpenAPI entries |
| D-1.1-13 | Job model | Sync by default; `wait: false` returns a job id; `get_job` and `cancel_job` exist |
| D-1.1-14 | Output path | Caller's `out` (file or folder), else the app's output root and category folder |
| D-1.1-15 | Downloads via agents | Yes: `download_link` beside `convert_file` |
| D-1.1-16 | Phasing | Engine → Utilities → Surfaces → Icons/UI → Helix removal |
| D-1.1-17 | Distribution | CLI/MCP bundled in the installer (on user PATH) and published to npm |
| D-1.1-18 | Agents UI | Settings **Agents** group (status, port, token copy, add-to-client buttons) plus `sparky init --client <id>` |
| D-1.1-19 | Docs | Landing site "For agents" section and tools page; README, context.md, CONTRIBUTING; Helix site and docs drop the converter; ElixirLabs chapter 05 copy |
| D-1.1-20 | Ports | Sparky joins the registry: site dev 4600, renderer `dev:ui` 4601, local API 8600 |

## Sparky 2.0 file manager (2026-11-05)

Source: `2026-11-05-sparky-2-file-manager.md`, section "Decisions".

| ID | Question | Decision |
|---|---|---|
| D-2.0-1 | How far | Full file manager now, not a Browse page first |
| D-2.0-2 | UI change | Atlas-style restyle: denser rows, themes, radial convert wheel |
| D-2.0-3 | Stack | Stay on Electron with native addons; no Tauri rewrite |
| D-2.0-4 | Release | Sparky 2.0 in place; Convert, Download and Tools stay inside |
| D-2.0-5 | Extras in 2.0 | Batch rename, archives as folders, tags and folder sizes, cloud and network drives |
| D-2.0-6 | Look | Close to Atlas: translucent panels, a theme set. Non-default themes may change the accent; the default theme keeps lime |
| D-2.0-7 | Windows depth | Sparky's own right-click menu plus "Open in Explorer"; no other apps' shell items, no Win+E takeover |
| D-2.0-8 | Main-window direction (2026-11-06) | C · Frost: floating rounded panels over the blurred desktop, soft lime selection tint, frosted job pill, convert wheel with lime last-used ring and spark burst. Comp: `apps/desktop/src/renderer/prototypes/file-manager/` (`data-mood="frost"`); critique `docs/design/2.0/README.md` |
| D-2.0-9 | Agent files: order (2026-11-07) | Agent file tools next on `sparky-2`, before UI steps 12-14; ships with 2.0, not as 1.4. Plan `2026-11-07-agent-files.md` |
| D-2.0-10 | Agent files: what comes back | Facts only (names, kinds, sizes, dates, types, counts); no contents or peeks; paths, never bytes |
| D-2.0-11 | Agent files: writes | Copy, move, rename, new folder, delete in the default `core` profile; delete is Recycle Bin only; every change journaled and undoable |
| D-2.0-12 | Agent files: window role | Two-way: an Agents place lists agent reads and changes with Undo; agents can open a folder, select files and read Harry's selection |

## Decided against

Source: `context.md`, section "Decided against".

| ID | Question | Decision |
|---|---|---|
| D-SIGN-1 | Code signing certificate | Harry decided (2026-09-25) to keep the SmartScreen warning rather than buy a certificate. Not open work. |
