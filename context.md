# Sparky — Project Context

**Current version:** 1.0.0 (root and `apps/desktop/package.json`)
**Last updated:** 2026-09-24 (v1.0.0 shipped)
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
- **Lime is the one accent**, shared with the ElixirLabs suite, defined once in `packages/ui/src/styles.css`: dark `--lime #b6f04a` / `--lime-foreground #0a0a0a` (14.7:1 on `#0a0a0a`), light `--lime #62990f` / `--lime-foreground #111111` (3.3:1 on `#fafafa` for rings and fills, 5.5:1 for dark text on it; `#7fc21c` fails at 2.1:1). `--ring` is the lime. Homes: the primary action (site "Download for Windows", app default `Button`), live/on states (switch on, `.sp-running` progress, the 3px lime rail on the active sidebar item and selected Performance level, the queue badge and dock dot), the focus ring, `::selection`, and the drag-over state (lime dashed border + `bg-lime/8`). Never body text, borders, backgrounds or gradients; Performance bars, success, warning and destructive keep their own colours. No narration captions, typewriter lines or step tickers on demos (`ui-anti-vibe.md`).
- **Plain language everywhere.** No cores, CPU/GPU, encoder, codec, bitrate, yt-dlp or FFmpeg in user-facing copy outside the credits line. Harry's `~/.claude/reference/ui-anti-vibe.md` applies: no text or pill above headings, no pill/chip/tip-card rows, no copy over an unmasked busy background.
- **Compression's first stop is "Lossless" (original quality export).**
- **Batch conversion is on by default**; the old "Jobs at once" 1–8 picker is gone. The rule is `batchConcurrency(level, cores, batch)` in `packages/core/src/levels.ts`: off or Low 1, Normal 2, Max half the processor threads clamped to 2–4. The engine re-applies it on every settings change; an old stored `concurrency` migrates to `batch` (> 1 means on) in `store.ts`.
- **Sites and brand marks:** one registry per site in `packages/core/src/sites.ts` (`SITES`, `siteFor(url)`), and its mark table in `packages/ui/src/brands.tsx` (`BRAND_MARKS`, `BrandMark`, `LinkMark`, official Simple Icons paths and hex, inline so they paint offline; near-black brands such as X and TikTok take the text colour). Add a site: one row in each.
- **Default output root is `Downloads\Sparky`** (`apps/desktop/src/main/index.ts`, `defaultRoot`), used for both downloads and conversions on a fresh install; an existing user's own choice in the settings DB is untouched.
- **Dropping a folder** adds the files inside it (one level, hidden files skipped): `expandFolders` in `apps/desktop/src/main/engine/convert.ts`. Files dragged anywhere over the window go to Convert via `renderer/src/components/FileDropOverlay.tsx`.
- **Type:** Satoshi, then a `"Satoshi Fallback"` face (`packages/ui/src/styles.css`) that maps local Segoe UI Variable / Segoe UI / Helvetica Neue / Arial onto Satoshi's vertical metrics (ascent 101%, descent 24%, gap 10%), one face per weight bucket so static Bold files still resolve, so the fallback lays out like the real font. Headlines are fluid: hero and Get `clamp(40px, 2.6vw + 26px, 64px)`, section h2 `clamp(36px, 2vw + 24px, 52px)`, leading 1.04. `SplitText` masks each word with `pb-[0.25em] -mb-[0.25em]` so the rise-in clip never cuts descenders (the old 0.08em cut Segoe's `y` and `g` flat when Satoshi was missing, 2026-09-24).
- **Fonts on Vercel:** `scripts/fetch-fonts.mjs` chmods 7-Zip on non-Windows; npm drops the execute bit and the Vercel build printed `7za EACCES`, so every deploy before 2026-09-24 shipped without Satoshi. If the Fontshare fetch fails, the build still succeeds (`;` in `vercel.json`) on the fallback face.
- **Site background:** `apps/web/src/components/GridCells.tsx` (fixed, `-z-10`, ported from Helix); the hero paints calm ground over it under the headline.
- **First paint is dark:** `renderer/index.html` starts with `class="dark"`, `useTheme` only toggles once settings arrive, and `main/index.ts` picks the window `backgroundColor` from the saved theme.
- **FFmpeg is the oldest BtbN release branch, never master.** Master and 9.0 need NVIDIA driver 610+ (NVENC API 13.1); 8.1 works on 591-era drivers. Checked on an RTX 2070 SUPER, driver 591.86.
- **Installer:** NSIS assisted (not one-click), per-user, directory choice, licence page, desktop + Start menu shortcuts, runs Sparky at finish. Unsigned: Windows SmartScreen warns on first run until the app is code-signed (needs a certificate; Harry's call).

## Build and verify

- `npm install`, then `npm run fetch-tools` and `npm run fetch-fonts` (Windows).
- `npm run check` — typecheck, all tests, both builds. Set `SPARKY_TEST_BIN` to the absolute `D:/sparky/sparky/apps/desktop/resources/bin` so the engine tests run the real tools (otherwise they skip); a relative path resolves against `apps/desktop` and the suites fail with `spawn ffmpeg ENOENT`.
- `npm test`'s `pretest` rebuilds better-sqlite3 for Node; run `npm run app-deps -w @sparky/desktop` before launching Electron again.
- `npm run package:win` builds `apps/desktop/release/Sparky-Setup.exe` + `latest.yml`.
- **VS Code terminals export `ELECTRON_RUN_AS_NODE=1`**, which makes Electron run as plain Node (`electron.app` undefined). Clear it before `npm run dev:app` or launching the exe.
- Electron is pinned to an exact version (`apps/desktop/package.json`): electron-builder can't resolve a range when npm hoists Electron to the workspace root.

## Open

- Code signing certificate (removes the SmartScreen warning).
- Older commits (before `10de03f`) carry a Claude co-author trailer from the web session that scaffolded the repo; rewriting them needs a force-push.

## Release history

- **v1.0.0** (2026-09-24): first release. Tag pushed, `.github/workflows/release.yml` built and published `Sparky-Setup.exe` + `latest.yml` (+ `.blockmap`) to GitHub Releases. The site's download button and `electron-updater` both verified live: `releases/latest/download/Sparky-Setup.exe` returns 200, `latest.yml` carries a valid version/sha512/size.
  - **Bug hit and fixed:** electron-builder's publish step raced itself (two near-simultaneous `publishing`/`creating GitHub release` calls in the job log) and created **two release objects for the same `v1.0.0` tag** — the canonical one held the installer and `latest.yml`, an orphan held only `Sparky-Setup.exe.blockmap`. A stray release sharing a `tag_name` makes GitHub 422 any `gh release edit` on either one (`Release.tag_name already exists`), which is why the workflow's "Write the release notes" step failed even though the build/publish step itself succeeded. Fixed manually for v1.0.0 (moved the blockmap onto the canonical release, deleted the orphan, then set the title/notes) and hardened the workflow with a "Collapse a duplicate release" step before the notes step, so any future tag self-heals instead of leaving a broken release + a stuck edit step.
