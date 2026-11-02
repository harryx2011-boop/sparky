Status: IN PROGRESS

# Sparky roadmap

Releases first, then the phases of the 1.1 plan (all done), then open items. Details: `context.md`.

## Releases

| Version | Date | What |
|---|---|---|
| 1.0.0 | 2026-09-24 | First release. Tag `v1.0.0`, installer on GitHub Releases. |
| 1.1.0 | 2026-09-25 | Engine in `packages/engine`, utilities (PDF, media, image, OCR), agent surfaces (MCP, CLI, local API), file icons, Helix converter removed. |
| 1.1.1 | 2026-09-25 | Finished single download opens the saved file. Setting `openFolderOnDownload`. Latest published release. |
| 1.2.0 | 2026-09-30 | Save as and Save all. Manifest bump, not tagged. |
| 1.3.0 | 2026-10-09 | MCP tool profiles and path guard. Manifest bump, installed locally, not tagged or released. |

## Phases of the 1.1 plan (archived)

Source: `archive/2026-09-25-sparky-1.1-agents-utilities.md`.

### Phase 1: engine package and the Helix port
- **Scope:** engine moves to `packages/engine` behind an op registry; Helix validators, ffmpeg builders and document pipeline port in.
- **Status:** Done 2026-09-25.
- **Exit test:** `npm run check` green; desktop app runs against `@sparky/engine`; document targets convert under Node.

### Phase 2: utilities
- **Scope:** 20 ops (12 PDF, 4 media, 3 image, OCR); TIFF output; LibreOffice-gated Office targets; Tools tab.
- **Status:** Done 2026-09-25.
- **Exit test:** every op has a test that runs the real binary when `SPARKY_TEST_BIN` is set; Convert page offers the new targets.

### Phase 3: agent surfaces
- **Scope:** HTTP API with token file on port 8600; `sparky` CLI; MCP stdio server from the registry; `sparky init` for four clients.
- **Status:** Done 2026-09-25.
- **Exit test:** `claude mcp add sparky -- cmd /c sparky mcp` works; `curl` with the token converts a file; `npm pack` of `@sparky-labs/cli` installs cleanly.

### Phase 4: icons and UI
- **Scope:** Windows association icons with a vendored vscode-icons fallback; Settings Diagnostics and Agents groups; site Tools and Agents sections.
- **Status:** Done 2026-09-25.
- **Exit test:** token check passes; no raw colour outside the token set; lime stays the one accent.

### Phase 5: Helix removal, docs, release
- **Scope:** Helix converter deleted in `D:\Helix`; Sparky release from the diff; docs updated.
- **Status:** Done 2026-09-25 (Helix commit `6f1f7a7`).
- **Exit test:** Helix API and dashboard build green; Sparky release workflow publishes the installer.

## Open items

- **Rebuild the installed app** for 1.3.0 and the transcript and progress changes: `node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky` (needs `--no-test`; the PDF word-timing test is slow).
- **Speech-to-text fallback** for videos with no captions. Not started.
- **Engine run test** for the transcript op with a fake yt-dlp. Not started.
- **Startup encoder probe** cache (`packages/engine/src/tools.ts:137-158`). Proposal, not started.
- **Older commits** carry a Claude co-author trailer; rewriting needs a force-push. Not done.

## Beyond the ask (proposals, not scheduled)

- Explorer right-click "Convert with Sparky" and a folder-watch mode.
- Output gaps: AVIF, JXL, OPUS, M4R outputs; lossless remux by default; HDR passthrough.
- Saved presets shared between the app, CLI and MCP.
