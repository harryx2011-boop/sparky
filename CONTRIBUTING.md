# Contributing to Sparky

Thanks for helping out! A few notes to make it smooth.

## Setup

```bash
npm install
npm run check      # type checks, tests and builds for everything
```

- `npm run dev:web` runs the landing site.
- `npm run dev:ui -w @sparky/desktop` runs the app's interface in a browser against a mock backend (`src/renderer/src/lib/mock.ts`). This is the quickest way to work on screens.
- `npm run fetch-tools`, then `npm run dev:app`, runs the real app. The tools are Windows builds, so this path needs Windows.

## Where things go

- **Pure logic** (formats, settings rules, tool command lines, output parsing) belongs in `packages/core`, with a test in `packages/core/test`.
- **Anything that runs a tool or touches files** belongs in `apps/desktop/src/main/engine`. Keep Electron imports out of it so it stays testable under Node; pass Electron features in through `EngineHost`.
- **Shared visuals** used by both the site and the app belong in `packages/ui`.

## Style

- TypeScript strict mode, 2-space indent, no semicolons, single quotes. Match the file you're in.
- Keep words people see plain and friendly: "graphics card", not "GPU encoder"; "shrink", not "transcode".
- Keep the landing page's cards in bento grids with mixed sizes, not even rows.

## Tests

`npm test` runs everything. For real conversions, set `SPARKY_TEST_BIN` to a folder with `ffmpeg`, `ffprobe`, `pandoc`, `7z` and `yt-dlp` (see the README).

## Releases

Push a tag like `v1.2.0`. The Release workflow builds `Sparky-Setup.exe` on Windows, bundles the tools, and publishes a GitHub release that installed copies update from.
