# Sparky — Project Context

**Current version:** 1.0.0 (root and `apps/desktop/package.json`)
**Last updated:** 2026-09-24
**Owner:** harryx2011@gmail.com
**Repo:** https://github.com/harryx2011-boop/sparky (public, MIT, default branch `main`)
**Site:** https://sparky-labs.vercel.app (Vercel project `sparky-labs`, production branch `main`, auto-deploys on push; config in `vercel.json`, upload filter `.vercelignore`)
**Installer:** `Sparky-Setup.exe` on GitHub Releases, built by `.github/workflows/release.yml` when a `v*` tag is pushed. The site's download button points at `releases/latest/download/Sparky-Setup.exe`, so the artifact name is fixed (no version in it) on purpose.

## What it is

A free Windows desktop app (Electron) that converts files (video, audio, images, documents, archives, and shrinking a file in its own format) and downloads from links (YouTube and the other yt-dlp sites, playlists, up to 4K), all on the user's PC. Also a suite chapter on ElixirLabs (`D:\ElixirLabs`, chapter 05).

## Layout

- `apps/desktop` — Electron app. `src/main/engine/` is the job engine (no Electron imports, tested under Node), `src/preload` the bridge (`window.sparky`), `src/renderer` the React UI. `npm run dev:ui -w @sparky/desktop` runs the UI in a browser against `lib/mock.ts`.
- `apps/web` — landing site (Vite + React + Motion).
- `packages/core` — pure logic and every user-facing label/error string (`levels.ts`, `display.ts`, `errors.ts`, `ytdlp.ts`).
- `packages/ui` — shared visuals (Performance bars, Compression slider, logo mark).
- `scripts/` — `fetch-tools.mjs` (bundled binaries into `apps/desktop/resources/bin`, gitignored), `fetch-fonts.mjs` (Satoshi, gitignored), `make-icons.mjs` (all icons + NSIS sidebar/header BMPs from one SVG).

## Decisions (settled 2026-09-24)

- **Logo:** dark tile `#0A0A0A` with a `#2A2A2A` hairline and a white `#EDEDED` bolt (inverted from the original light tile). Source of truth: `scripts/make-icons.mjs`.
- **Dark mode is the app default.** The site is dark only.
- **Plain language everywhere.** No cores, CPU/GPU, encoder, codec, bitrate, yt-dlp or FFmpeg in user-facing copy outside the credits line. Harry's `~/.claude/reference/ui-anti-vibe.md` applies: no text or pill above headings, no pill/chip/tip-card rows, no copy over an unmasked busy background.
- **Compression's first stop is "Lossless" (original quality export).**
- **Batch conversion is on by default**; the old "Jobs at once" 1–8 picker is gone. The rule is `batchConcurrency(level, cores, batch)` in `packages/core/src/levels.ts`: off or Low 1, Normal 2, Max half the processor threads clamped to 2–4. The engine re-applies it on every settings change; an old stored `concurrency` migrates to `batch` (> 1 means on) in `store.ts`.
- **Sites and brand marks:** one registry per site in `packages/core/src/sites.ts` (`SITES`, `siteFor(url)`), and its mark table in `packages/ui/src/brands.tsx` (`BRAND_MARKS`, `BrandMark`, `LinkMark`, official Simple Icons paths and hex, inline so they paint offline; near-black brands such as X and TikTok take the text colour). Add a site: one row in each.
- **Dropping a folder** adds the files inside it (one level, hidden files skipped): `expandFolders` in `apps/desktop/src/main/engine/convert.ts`. Files dragged anywhere over the window go to Convert via `renderer/src/components/FileDropOverlay.tsx`.
- **Site background:** `apps/web/src/components/GridCells.tsx` (fixed, `-z-10`, ported from Helix); the hero paints calm ground over it under the headline.
- **First paint is dark:** `renderer/index.html` starts with `class="dark"`, `useTheme` only toggles once settings arrive, and `main/index.ts` picks the window `backgroundColor` from the saved theme.
- **FFmpeg is the oldest BtbN release branch, never master.** Master and 9.0 need NVIDIA driver 610+ (NVENC API 13.1); 8.1 works on 591-era drivers. Checked on an RTX 2070 SUPER, driver 591.86.
- **Installer:** NSIS assisted (not one-click), per-user, directory choice, licence page, desktop + Start menu shortcuts, runs Sparky at finish. Unsigned: Windows SmartScreen warns on first run until the app is code-signed (needs a certificate; Harry's call).

## Build and verify

- `npm install`, then `npm run fetch-tools` and `npm run fetch-fonts` (Windows).
- `npm run check` — typecheck, all tests, both builds. Set `SPARKY_TEST_BIN=apps/desktop/resources/bin` so the engine tests run the real tools (otherwise they skip).
- `npm test`'s `pretest` rebuilds better-sqlite3 for Node; run `npm run app-deps -w @sparky/desktop` before launching Electron again.
- `npm run package:win` builds `apps/desktop/release/Sparky-Setup.exe` + `latest.yml`.
- **VS Code terminals export `ELECTRON_RUN_AS_NODE=1`**, which makes Electron run as plain Node (`electron.app` undefined). Clear it before `npm run dev:app` or launching the exe.
- Electron is pinned to an exact version (`apps/desktop/package.json`): electron-builder can't resolve a range when npm hoists Electron to the workspace root.

## Open

- First release: push tag `v1.0.0` to publish the installer; until then the site's download button 404s.
- Code signing certificate (removes the SmartScreen warning).
- Older commits (before `10de03f`) carry a Claude co-author trailer from the web session that scaffolded the repo; rewriting them needs a force-push.
