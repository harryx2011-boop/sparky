# Helix file-conversion surfaces: map for the Sparky port

Research report, 2026-09-25. Read from `D:\Helix` at HEAD `47448ea` (root version 1.24.0). Nothing was edited. Companion: `freeconvert-catalog.md`. Plan that consumes this: `../plans/sparky-1.1-agents-utilities.md`.

## 1. Where Helix converts files

| # | Surface | Path | Runtime | Entry point | Status |
|---|---|---|---|---|---|
| A | Browser converter engine (upstream) | `apps/converter/lib/engine/**`, `lib/formats.ts` | Browser: Web Workers running ffmpeg.wasm, jsquash wasm codecs, JS document libraries | `submitEngineJob(req: EngineRequest): JobHandle` at `lib/engine/index.ts:330` | Upstream copy, kept for the engine and its unit tests (`CONVERTER-CONTRACT.md:17-18`) |
| A' | The same engine, deployed | `apps/dashboard/lib/converter/**`, `components/converter/**`, route `/convert` | Browser | same | Deployed (merged 2026-09-06). Byte-identical to A except CRLF in `document.worker.ts` and import paths in `jobs/client.ts` |
| B | `POST /v1/convert` | `apps/api/src/routes/convert.ts` | Node 22 Fastify, forwards to C | `registerConvert(app, deps)` at `:175`, wired at `apps/api/src/index.ts:328` | Deployed |
| B' | `POST /v1/document` with `op: convert` | `apps/api/src/routes/document.ts:24-28` | Node | Dispatches to `/v1/convert` | Deployed |
| C | helix-extract `/convert` | `apps/extract/helix_extract/convert.py`, `main.py:313-359` | Python 3.12 FastAPI, pypdfium2, Pillow | `convert_file()`, `convert_pdf_page()`, `convert_image()` | Deployed (helix-extract 1.6.2) |
| D | `apps/converter-api` | git history only, `f0317af^:apps/converter-api/` | Node Fastify, native ffmpeg via `spawn`, sharp ^0.33.5 | `src/ffmpeg/run.ts`, `src/jobs/manager.ts` | Deleted in `f0317af` ("Helix 1.12.0"); empty folder remains on disk |

The CLI (`packages/cli`) has no convert command. The MCP server exposes B automatically as `helix_convert` (section 4).

## 2. Operations per surface

### A. Browser engine (`apps/converter/lib/engine/`)

`types.ts:3-11`:

```ts
export type EngineOp = 'convert' | 'compress' | 'gif' | 'image' | 'thumbs' | 'document';

export type EngineRequest =
  | { op: 'convert'; file: File; to: string; options: ConvertOptions }
  | { op: 'compress'; file: File; to?: string; target?: number; preset?: CompressOptions['quality']; options: ConvertOptions }
  | { op: 'gif'; file: File; fps: number; width: number; options: Partial<Omit<GifOptions, 'fps' | 'width'>> }
  | { op: 'image'; file: File; to: string; resize?: { width: number; height: number }; quality?: number; options: ImageOptions }
  | { op: 'thumbs'; file: File; options: ThumbsOptions }
  | { op: 'document'; file: File; to: string; options: DocumentOptions };
```

`ProgressFrame` and `JobHandle` are in `types.ts:13-25`; worker message types in `types.ts:38-81`.

Routing (`index.ts:330-345`): `thumbs` to the ffmpeg worker; `document` to the document worker; `image` to the image worker; a `convert` whose target is a document format goes to the document worker, a still image to the image worker, everything else to ffmpeg.

Media formats (`engine/formats.ts`): video `mp4 webm mov avi mkv`; audio `mp3 wav ogg m4a flac aac`; image `jpg jpeg png webp avif tiff`; gif `gif apng`. `heic`/`heif` input only (no wasm HEVC encoder).

UI targets (`lib/formats.ts:46-71`):

| Kind | Targets |
|---|---|
| video | mp4 mov mkv avi gif mp3 m4a wav aac flac ogg |
| audio | mp3 wav m4a flac ogg aac |
| image | jpg png webp avif tiff gif |
| gif | gif apng mp4 mov png webp |
| document | pdf csv xlsx json xml txt html md |

`webm` is excluded as an output because libvpx-vp9 hangs in single-threaded wasm. That is wasm-only and does not apply to native ffmpeg.

Option schemas (`options.ts`):

```ts
export type Trim = { start: number; end: number };
export type Crop = { x: number; y: number; width: number; height: number };
export type Rotation = 0 | 90 | 180 | 270;
export type Flip = 'h' | 'v' | 'hv';
export type ConvertOptions = {
  crf?: number; videoBitrate?: number; audioBitrate?: number; width?: number; height?: number; fps?: number;
  rotate?: Rotation; flip?: Flip; trim?: Trim; crop?: Crop;
  preset?: 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow'; stripAudio?: boolean; targetBytes?: number;
};
export type CompressOptions = ConvertOptions & { target?: number; quality?: 'email' | 'discord' | 'web' | 'archive'; };
export type ThumbsOptions = { mode: 'poster' | 'sprite' | 'preview'; width: number; at?: number; count?: number; columns?: number; durationSec?: number; fps?: number; };
export type GifOptions = { fps: number; width: number; trim?: Trim; loop: boolean; dither: 'none' | 'bayer' | 'floyd_steinberg' | 'sierra2_4a'; };
export type ImageOptions = { quality?: number; width?: number; height?: number; fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'; rotate?: Rotation; flip?: Flip; lossless?: boolean; };
export const PRESET_TARGETS: Record<'email' | 'discord' | 'web' | 'archive', number | null> = {
  email: 25 * 1024 * 1024, discord: 10 * 1024 * 1024, web: null, archive: null };
export type DocumentOptions = {
  delimiter?: ',' | ';' | '\t' | '|'; header?: boolean; sheet?: number | string;
  indent?: 0 | 2 | 4; pageSize?: 'a4' | 'letter' | 'legal'; orientation?: 'portrait' | 'landscape'; };
```

Validation (`options.ts:114-229`): dimensions 16–16384; crf 0–51; fps 1–240; video bitrate 1k–200M; audio bitrate 8k–2M; `targetBytes` 64k–5 GiB; GIF fps 1–50; sprite `columns × width` ≤ 16384. `bitrateForTarget` (`:192`) computes `(bytes*8/sec − audio) * 0.94`.

Document targets (`documents.ts:69-86`):

```ts
export const DOC_TARGETS: Record<DocFormat, readonly DocFormat[]> = {
  csv: ['xlsx', 'json', 'html', 'md', 'txt', 'pdf'],
  xls: ['csv', 'xlsx', 'json', 'html', 'md', 'txt', 'pdf'],
  xlsx: ['csv', 'json', 'html', 'md', 'txt', 'pdf'],
  json: ['csv', 'xlsx', 'xml', 'txt', 'html', 'md', 'pdf'],
  md: ['html', 'txt', 'pdf'],
  html: ['md', 'txt', 'pdf'],
  txt: ['md', 'html', 'pdf'],
  xml: ['json', 'txt', 'html', 'pdf'],
  pdf: ['txt', 'md', 'html'],
};
```

Aliases: `markdown`/`mdown` → md, `htm` → html, `text`/`log` → txt. `table → xml` is implemented in the worker (`document.worker.ts:354-358`) but only `json → xml` is in `DOC_TARGETS`.

Defect: `readWorkbook` (`document.worker.ts:53-57`) calls `wb.xlsx.load` for xls too. ExcelJS cannot parse BIFF8, so `.xls` input fails; `lib/formats.ts:222` drops xls from generated pairs; no test covers it. In Sparky, xls goes through LibreOffice when present.

Document worker pipeline (`document.worker.ts:333-414`): tables via papaparse/exceljs/JSON to `Cell[][]`; text via marked (md→html), turndown (html→md), fast-xml-parser, in-file `stripHtml`; PDF text via pdfjs-dist `legacy/build/pdf.mjs` with a clear "scan, no text layer" error (`:134`); PDF output via pdf-lib Helvetica with wrapping, pagination and `?` for non-WinAnsi.

ffmpeg argument builders (`args.ts`, 195 lines, pure): `convertArgs` (codec tables; crop/scale/hflip/vflip/transpose/fps filters; trim before `-i`; `-progress pipe:1`), `gifArgs` (two-pass palettegen/paletteuse), `thumbsArgs` (poster, sprite `fps=count/dur` + `tile=CxR`, preview animated webp), `compressArgs` (target-size solver or crf 18/23/26 by preset).

### B. `POST /v1/convert`

| Source | Targets |
|---|---|
| pdf | png, jpeg (one page at a chosen dpi) |
| png | jpeg |
| jpg | png |

### C. helix-extract `/convert`

Same `SUPPORTED_TARGETS` (`convert.py:46-50`), `DEFAULT_DPI = 144`, pypdfium2 at scale `dpi/72`, JPEG flattens alpha onto white at quality 90. Query `to`, `page ≥ 1`, `dpi` 36–600; body is raw bytes, Content-Type selects the source. 400 empty body, 415 unsupported, 422 `DocumentError`. Response is bytes plus `x-helix-convert-pages` and `x-helix-convert-page`.

### D. Deleted `converter-api`

`src/ffmpeg/{args,formats,image,limits,options,run}.ts`, `src/jobs/{manager,queue,types}.ts`, `src/routes/{jobs,upload}.ts`, `src/storage/temp.ts`. `run.ts` has `FFMPEG_BIN = process.env.FFMPEG_PATH ?? 'ffmpeg'`, an ffprobe `probe()`, and a `-progress` parser. Recover with `git -C D:\Helix show f0317af^:apps/converter-api/src/ffmpeg/run.ts`.

## 3. HTTP contract of `POST /v1/convert`

```ts
const VALID_SOURCES = new Set<FileType>(['pdf', 'png', 'jpg']);
const SUPPORTED_TARGETS: Record<'pdf' | 'png' | 'jpg', readonly ConvertFormat[]> = {
  pdf: ['png', 'jpeg'], png: ['jpeg'], jpg: ['png'] };
const ConvertOptionsSchema = z.object({
  to: z.enum(['png', 'jpeg']),
  page: z.number().int().min(1).default(1),
  dpi: z.number().int().min(36).max(600).default(144),
  timeout: z.number().int().min(1_000).max(300_000).default(30_000),
});
const ConvertJsonRequestSchema = ConvertOptionsSchema.extend({ url: z.string().url() });
```

Request: JSON `{url, to, page?, dpi?, timeout?}` or `multipart/form-data` with `file` plus fields (`:57-93`). OpenAPI: `ConvertRequest`, `ConvertUpload`, `ConvertResponse` at `openapi.yaml:3005-3050`.

Success: 200, converted bytes, `content-type`, `content-disposition: attachment; filename="<base>.<png|jpg>"`, `x-helix-convert-pages`, `x-helix-convert-page`.

Typed failure: 200 with `{ success: false, failure: { url, reason, detail, detectedBy: [], escalationAvailable } }`; `reason` one of `empty`, `unsupported_type`, `service_unavailable`, `timeout`, or a fetch failure.

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_request` | Bad schema, missing `url`/`file`, bad multipart, disallowed host |
| 401 | `unauthorized` | No bearer key |
| 413 | `payload_too_large` | Over `HELIX_PARSE_MAX_UPLOAD_MB` |
| 415 | `unsupported_type` | Target unreachable from source |
| 503 | `service_unavailable` | Over `HELIX_PARSE_MAX_INFLIGHT` (default 8), `retry-after: 1` |
| 500 | `internal_error` | Anything else |

## 4. MCP server

Files: `apps/api/src/mcp/server.ts` (176), `tools.ts` (250), `spec.ts` (123), `tools.test.ts` (597). SDK `@modelcontextprotocol/sdk` ^1.0.4 declared, 1.30.0 installed.

No tool is written by hand: `generateTools(spec, isLive)` (`tools.ts:143-210`) walks `openapi.yaml`, keeps operations Fastify has (`app.hasRoute`), names them `helix_` + snake-cased `operationId`, builds the input schema from the request body with `$ref`s inlined, and replays calls in-process with `app.inject` (`server.ts:96-136`).

```ts
const server = new Server({ name: 'helix', version }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getTools().map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
}));
server.setRequestHandler(CallToolRequestSchema, async (call) => {
  const tool = getTools().find((t) => t.name === call.params.name);
  const planned = planRequest(tool, call.params.arguments ?? {}, prefix);
  const response = await app.inject({ method: planned.method, url: planned.url, headers, payload: planned.body });
  return contentFromResponse(response.statusCode, response.body);
```

`CONFIRM_REQUIRED` (`tools.ts:55-80`) gates destructive tools behind `confirm: true` (`server.ts:105-116`). 54 operationIds become `helix_<snake>` tools; `HELIX_MCP_TOOLS` trims the set. Transport: streamable HTTP only, stateless, at `/mcp` on the API process (`server.ts:141-175`, `index.ts:469`); no stdio. Auth: bearer key verified in `core/auth.ts:67-125`; the replay uses a single-use `x-helix-internal-ticket`.

Issue read from code: `contentFromResponse` (`server.ts:48-62`) returns bodies as text, so `helix_convert`'s PNG/JPEG bytes reach an MCP caller mangled.

## 5. CLI

`packages/cli` (`@helix/cli` 1.6.1; `VERSION` constant says `'0.1.0'`): `src/bin.ts` (88), `args.ts` (76), `harnesses.ts` (88), `init.ts`, `writers.ts`, `skill.ts`. Hand-rolled argv parser (`args.ts:20-61`). Only command: `helix init [--all | --client <id>…] -k <key> [--mcp-url] [--site-url] [--no-skill] [--dry-run]`. Other commands exit 2. `"bin": {"helix": "./dist/bin.js"}`, not published.

Registry pattern worth copying, `HARNESSES` (`harnesses.ts:25-73`):

```ts
{ id: 'cursor', label: 'Cursor', markers: ['.cursor'],
  mcpConfigPath: (home) => join(home, '.cursor', 'mcp.json'),
  skillPath: (home) => join(home, '.cursor', 'skills', 'helix', 'SKILL.md'),
  writeMcp: (home, target) => { const path = join(home, '.cursor', 'mcp.json'); upsertJsonMcpServer(path, cursorEntry(target)); return path; } },
```

Windows bug, confirmed by running it: `bin.ts:86` guards with ``import.meta.url === `file://${process.argv[1]}` ``, which is false on Windows (`file:///C:/…` vs `C:\…`). Use `pathToFileURL(process.argv[1]).href`.

## 6. Dependencies

| Surface | Package | Version |
|---|---|---|
| A ffmpeg worker | @ffmpeg/ffmpeg, @ffmpeg/util; core 0.12.10 fetched from unpkg | ^0.12.15 / ^0.12.2 |
| A image worker | @jsquash/avif, jpeg, png, webp, resize; libheif-js; utif2 | 2.1.1, 1.6.0, 3.1.1, 1.5.0, 2.1.1; 1.19.8; 4.1.0 |
| A document worker | exceljs, pdf-lib, pdfjs-dist, papaparse, marked, turndown, fast-xml-parser | 4.4.0, 1.17.1, 4.10.38, 5.5.0, 15.0.0, 7.2.0, 5.0.0 |
| A build | esbuild ^0.28.2 via `scripts/build-workers.mjs` | |
| B | fastify ^5.1.0, zod ^3.23.8, `parse/file-type.ts`, `parse/remote.ts` | |
| C | pypdfium2 ≥4.30, pillow ≥11.0, fastapi ≥0.115 | |
| MCP | @modelcontextprotocol/sdk, js-yaml | 1.30.0, ^4.1.0 |

## 7. Portability into Sparky's Electron main process

Sparky has no MCP server and no CLI. `apps/desktop` has sharp ^0.35.4 and pdfjs-dist ^6.3.289, and bundles native ffmpeg, pandoc and 7-zip; LibreOffice, Ghostscript and Deno are detected optional tools.

| Piece | Verdict | Overlap with Sparky |
|---|---|---|
| `engine/args.ts`, `options.ts`, `formats.ts`, `mime.ts`, `documents.ts` | Ports unchanged (pure TS). `-progress pipe:1` works with native ffmpeg. Drop the VP9/webm exclusions | `buildFfmpegPlan` (`packages/core/src/ffmpeg.ts:96`) has palettegen GIF. Missing: crop, rotate, flip, thumbs, target-size solver, `stripAudio` |
| `engine/index.ts` | Browser only (`Worker`, `Blob`, `File`) | Replaced by `engine/queue.ts` and `runConvertJob` (`convert.ts:409`) |
| `probe.ts` | Browser only | Sparky has ffprobe (`FFPROBE_ARGS`, `parseFfprobe`) |
| `workers/ffmpeg.worker.ts` | Browser only | Native ffmpeg + `createFfmpegProgressParser` |
| `workers/image.worker.ts` | Browser only (`ImageData`, fetch-based wasm) | sharp covers png/jpg/webp/avif. Missing: tiff output, `fit` modes, rotate/flip, lossless webp |
| `workers/document.worker.ts` | Ports with small edits (`postMessage` → return/progress callback; `ArrayBuffer` → `fs.readFile`). turndown's Node entry uses `@mixmark-io/domino` | Sparky has no csv/xlsx/json/xml at all. pdfjs 4.10 → 6.3 import path needs checking |
| B `/v1/convert` | Contract only | pdfjs render + sharp already cover it |
| C Python | Not portable, not needed | pdfjs + sharp replace pypdfium2 + Pillow |
| MCP pattern | `Server` + `setRequestHandler` ports; OpenAPI generation and `app.inject` do not | Use `StdioServerTransport` |
| CLI pattern | `args.ts` and `harnesses.ts` port; fix the Windows guard | |

## 8. Tests worth copying

- `apps/converter/lib/engine/__tests__/args.test.ts` (87), `thumbs.test.ts` (96), `options.test.ts` (100), `documents.test.ts` (113), `document-pairs.test.ts` (65), `formats.test.ts` (28). All vitest `environment: 'node'`.
- `apps/converter/lib/ai/__tests__/*` and `lib/ai/schema.ts` (`EngineRequest` without `file`): the "Ask AI" intent resolver, a natural fit for the MCP tool schema.
- `apps/api/src/routes/convert.test.ts` (290), `apps/api/src/mcp/tools.test.ts` (597; `:186-204` asserts the `helix_convert` schema).
- Deleted, recoverable with `git show f0317af^:<path>`: `apps/converter-api/test/args.test.ts` (207), `convert.integration.test.ts`, `image.integration.test.ts` (ran native ffmpeg and sharp).
- No tests exist for the document worker itself (`writePdf`, `readWorkbook`, the pipeline).
