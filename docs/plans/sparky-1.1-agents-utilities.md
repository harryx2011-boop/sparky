# Sparky 1.1: engine package, utilities, agent surfaces, real file icons

Plan settled with Harry on 2026-09-25 across 20 questions. Inputs: `../research/helix-converter-map.md`, `../research/freeconvert-catalog.md`. Orchestrator: the main session. Coders: Opus agents, one phase per turn, each phase green (`npm run check` with `SPARKY_TEST_BIN` set) before the next.

Release level is decided from the diff at the end, per `~/.claude/reference/versioning.md`. Expected: Sparky **1.1.0** (additive: new tools, new surfaces, no removed contract). Helix loses a public route and an MCP tool, which the same rules score as MAJOR; that number is Harry's call in Phase 5.

## Decisions (the 20 answers)

| # | Question | Decision |
|---|---|---|
| 1 | Engine home | Both: `packages/engine` shared package, and the running app hosts the HTTP API; CLI and MCP fall back to running the engine in-process when the app is closed |
| 2 | Agent surfaces | MCP over stdio, local HTTP API, CLI. No MCP-over-HTTP |
| 3 | Local auth | Token file in app data (`%APPDATA%\Sparky\api-token`), loopback only |
| 4 | "Built-in tools" group | Removed from its place in Settings; tool status rows and the downloader update button move into a new **Diagnostics** group |
| 5 | Utility families | PDF toolkit, Helix data documents, media editing ops, image editing ops |
| 6 | Office formats | Detect LibreOffice (already an optional tool); targets light up when `soffice` is found |
| 7 | OCR / ebook | OCR via `tesseract.js` (English bundled, other languages on demand). No ebook this round |
| 8 | Version | 1.1.0 target; final level from the diff |
| 9 | Icon source | Windows association first (`app.getFileIcon`), bundled fallback |
| 10 | Fallback pack | VS Code icons (`vscode-icons`, MIT). Built as a portable unit so Cortex and Helix can adopt it. Noted (Luminous) keeps its own badges |
| 11 | Icon placement | Convert file rows, format picker targets, queue/dock/history rows. Sidebar keeps lucide |
| 12 | Helix boundary | Remove everything named convert: browser converter, `/v1/convert`, `helix_convert`, extract's `convert.py`, tests, OpenAPI entries |
| 13 | Job model | Sync by default; `wait: false` returns a job id; `get_job` and `cancel_job` exist |
| 14 | Output path | Caller's `out` (file or folder), else the app's output root and category folder |
| 15 | Downloads via agents | Yes: `download_link` beside `convert_file` |
| 16 | Phasing | Engine → Utilities → Surfaces → Icons/UI → Helix removal |
| 17 | Distribution | CLI/MCP bundled in the installer (on user PATH) and published to npm |
| 18 | Agents UI | Settings **Agents** group (status, port, token copy, add-to-client buttons) plus `sparky init --client <id>` |
| 19 | Docs | Landing site "For agents" section and tools page; README, context.md, CONTRIBUTING; Helix site and docs drop the converter; ElixirLabs chapter 05 copy |
| 20 | Ports | Sparky joins the registry: site dev 4600, renderer `dev:ui` 4601, local API 8600 |

## Architecture

### The op registry is the one seam

Every capability is an **op module** in `packages/engine/src/ops/<op>.ts` exporting one object, registered by one line in `ops/index.ts`. The app's format picker, the HTTP routes, the MCP tool list and the CLI commands are all generated from that registry; none of them names an op by hand.

```ts
export interface Op<I extends z.ZodTypeAny> {
  id: string                        // 'convert', 'pdf.merge', 'image.resize', 'ocr'
  label: string                     // plain language, for the app and the CLI help
  category: Category | 'pdf' | 'tool'
  input: I                          // zod schema: file(s), target, options
  accepts: (ext: string) => boolean // which sources this op takes
  targets?: (ext: string) => string[]
  requires?: ToolId[]               // e.g. ['libreoffice']; op is hidden when missing
  run(ctx: OpContext, args: z.infer<I>): Promise<OpResult>
}
```

`OpContext` carries tools, temp dir, output resolver, an `AbortSignal` and a progress callback. `OpResult` is `{ outputs: string[], warnings?: string[] }`. The existing `runConvertJob` becomes the `convert` op; `runDownloadJob` becomes `download`.

### Packages after Phase 1

| Package | Contents |
|---|---|
| `@sparky/core` | Unchanged role: labels, errors, format registry, plans. Gains Helix's option types and validators |
| `@sparky/engine` (new) | Everything now in `apps/desktop/src/main/engine` plus `ops/`, `document/` (Helix worker port), `pdf/`, `image/`, `media/`, `ocr/`. Node 22, no Electron import |
| `@sparky/cli` (new, npm name `@sparky-labs/cli`, bin `sparky`) | `sparky convert|pdf|image|video|audio|download|formats|jobs|serve|mcp|init`. `sparky mcp` is the stdio MCP server; `sparky serve` runs the HTTP API without the app |
| `@sparky/desktop` | Electron shell. Hosts the HTTP API on 8600 while open, owns the token file, the Diagnostics and Agents Settings groups, file icons |
| `@sparky/ui` | Gains `file-icons/` (portable unit) |
| `@sparky/web` | Landing site gains "For agents" and the tools page |

### Surfaces

- **HTTP API** (`packages/engine/src/http/`, Fastify 5, bound to `127.0.0.1:8600`): `GET /v1/ops`, `GET /v1/formats`, `POST /v1/jobs` (`{ op, args, wait? }`), `GET /v1/jobs/:id`, `DELETE /v1/jobs/:id`, `GET /v1/health`. Bearer token from the token file. Errors follow Helix's `{ error, message, field?, requestId }` shape. Inputs are local paths; no uploads over HTTP.
- **MCP stdio** (`packages/cli/src/mcp.ts`): `@modelcontextprotocol/sdk` `Server` + `StdioServerTransport`. Tools generated from the op registry: `sparky_convert_file`, `sparky_pdf_merge`, `sparky_pdf_split`, `sparky_images_to_pdf`, `sparky_pdf_to_images`, `sparky_image_resize`, `sparky_video_trim`, `sparky_compress`, `sparky_ocr`, `sparky_download_link`, `sparky_list_formats`, `sparky_get_job`, `sparky_cancel_job`. Responses are text with output paths, never raw bytes (the Helix `helix_convert` defect). When the app is open the server forwards to the HTTP API so jobs appear in the app's Queue; otherwise it runs the engine in-process.
- **CLI**: Helix's `args.ts` parser and `HARNESSES` registry ported; entry guard uses `pathToFileURL(process.argv[1]).href`. `sparky init --client claude-code|cursor|codex|windsurf` writes the MCP entry.
- **Token**: the app (or `sparky serve`) writes a 32-byte random token to `%APPDATA%\Sparky\api-token` on first start, mode 0600. Clients read it. `sparky init` embeds the token path, not the token.

## Phases

### Phase 1: engine package and the Helix port

Agents: `backend-architect` reviews the op registry design first; two Opus `general-purpose` coders in parallel (A: move `apps/desktop/src/main/engine` to `packages/engine`, introduce `ops/`, migrate `convert` and `download` into ops, keep every existing test green; B: port Helix `args.ts`, `options.ts`, `documents.ts`, `document.worker.ts` into `packages/core` and `packages/engine/src/document/` with Helix's six test files adapted, plus new tests for `writePdf` and `readWorkbook`); then `test-runner` and `reviewer`.

Exit: `npm run check` green, desktop app runs unchanged against `@sparky/engine`, `DOC_TARGETS` pairs convert end to end under Node.

**Done 2026-09-25.** Engine in `packages/engine` behind `src/ops/`; Helix's validators, ffmpeg builders and document pipeline in `packages/core` and `packages/engine/src/document`; csv/xlsx/json/xml reachable through `convert`. Reviewer found 2 critical, 4 major and 7 minor defects, all fixed with failing-first tests. Final check: typecheck 5 workspaces, core 158 + engine 147 tests (0 skipped), both builds. The running app was not launched by hand; the bundle builds and resolves `@sparky/engine`.

### Phase 2: utilities

Agents: three Opus coders in parallel, one per module, each with tests against real tools.

- `pdf/`: `images_to_pdf` (page size, orientation, margin, one PDF per batch or per image), `pdf_to_images` (dpi, page range, via pdfjs + sharp), `merge`, `split` (ranges, every N, odd/even), `rotate`, `remove_pages`, `extract_pages`, `extract_images`, `compress` (Ghostscript when found, else pdf-lib re-save), `protect`, `unlock`, `flatten`. pdf-lib, pdfjs-dist, sharp.
- `media/`: crop, rotate, flip, strip audio, thumbs (poster, sprite, preview), target-size compress with Email/Discord presets, volume, fade, reverse, trim. Extends `buildFfmpegPlan`.
- `image/` and `ocr/`: resize by width/height/percent, fit modes, rotate/flip, strip metadata, lossless webp, tiff out, ico size sets, images to GIF; OCR via `tesseract.js` to txt or searchable PDF. LibreOffice-gated targets (xls, ppt, pptx, odt, ods, odp, rtf, doc → pdf) wired in `formats.ts` with `requires: ['libreoffice']`.

Exit: every op has a test that runs the real binary when `SPARKY_TEST_BIN` is set; the app's Convert page offers the new targets and a new **Tools** tab lists the non-conversion ops.

**Done 2026-09-25.** 20 ops (12 PDF, 4 media, 3 image, OCR), TIFF output, LibreOffice-gated Office targets, a schema-generated Tools page and Convert-page target filtering. Secrets mechanism added for PDF passwords. Reviewer found 3 critical, 5 major and 8 minor defects (OCR broken in packaged Windows builds by a path regex, an OCR hang on any non-bundled language, boolean defaults making PDF permissions unrestrictable from the form, and more), all fixed with failing-first tests. A portable Ghostscript 10.08 extracted into the scratchpad ran the real PDF tests and exposed one more: Ghostscript exits 0 on a wrong password and writes an empty file; every Ghostscript call now checks stderr. Final check: typecheck 5 workspaces, core 173 + engine 274 + desktop 7 tests (1 skipped: the without-Ghostscript case), both builds. Deferred: OCR of PDF inputs (rasterizer exists, wiring is a Phase 3 follow-up), `image.edit` on animated sources keeps the first frame, the packaged installer was not built so the tesseract asar worker path is untested until Phase 3's installer work.

### Phase 3: agent surfaces

Agents: `mcp-builder` skill loaded; Opus coder A (HTTP API + token + app hosting on 8600), Opus coder B (`@sparky/cli`: commands, `mcp`, `serve`, `init`, HARNESSES); `reviewer`; `test-runner`. An MCP eval: Claude Code calls `sparky_images_to_pdf` on two PNGs and the PDF exists.

Exit: `claude mcp add sparky -- sparky mcp` works; `curl` with the token converts a file; installer puts `sparky.exe` on PATH; `npm pack` of `@sparky-labs/cli` installs cleanly (npm org name to verify before publish).

### Phase 4: icons and UI

Agents: `frontend` skill; `visual-designer` spec first; two Opus coders (icons; Settings groups + landing site).

- `packages/ui/src/file-icons/`: `registry.ts` (ext → SVG), the vendored `vscode-icons` subset for every format Sparky reads or writes, `FileIcon.tsx`. MIT text added to `THIRD_PARTY_NOTICES.md`. The folder is self-contained so Cortex and Helix can copy it.
- Desktop: `app.getFileIcon(<probe>.<ext>, { size: 'large' })` per extension, cached per session, sent as data URLs over the bridge. Generic-icon detection: hash the icon Windows returns for a nonsense extension and treat a match as "no association", then fall back to the pack.
- Placement: Convert rows, format picker targets, Queue, dock, History.
- Settings: "Built-in tools" group deleted; **Diagnostics** group holds tool status and the downloader update button; **Agents** group shows API status, port, token copy, and add-to-client buttons.
- Landing site: "For agents" section (MCP snippet, CLI example) and the tools page.

Exit: kansei token check passes, no raw colour outside the token set, lime stays the one accent.

### Phase 5: Helix removal, docs, release

Agents: Opus coder in `D:\Helix` (delete `apps/converter`, `apps/dashboard/lib/converter`, `components/converter`, `app/converter.css`, `/convert` routes, `CONVERTER-CONTRACT.md`, `apps/api/src/routes/convert.ts` and its test, extract `convert.py` and tests, the `convert` operationId and schemas in `openapi.yaml`, nav and footer rows, README and context mentions; grep `convert` across the repo until only unrelated hits remain); `reviewer`; `test-runner` in Helix.

Then: Sparky version from the diff, tag, release workflow; Helix version from the diff (MAJOR by the rules; Harry decides); ElixirLabs chapter 05 copy; README, context.md, CONTRIBUTING in both repos.

## Beyond the ask (proposals, not scheduled)

- Explorer right-click "Convert with Sparky" and a folder-watch mode.
- Output gaps FreeConvert cannot fill: AVIF, JXL, OPUS, M4R outputs; lossless remux by default; HDR passthrough.
- Saved presets shared between the app, CLI and MCP.
- Code signing (still the open item from 1.0.0).
