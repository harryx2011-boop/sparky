# 0002: A native addon lists folders

Status: Accepted (Harry, 2026-11-06)   ·   Date: 2026-11-05   ·   Plan: `docs/plans/2026-11-05-sparky-2-file-manager.md`

## Context
Sparky stays on Electron (D-2.0-3). On Harry's PC (warm cache, Node 24), `fs.readdir` lists 100,000 names in about 150 ms, but getting each file's size and date with `fs.stat` takes 4 to 4.7 s even in parallel; a larger libuv thread pool did not help. Windows returns size and dates with each entry when a folder is listed, and Node drops them (nodejs/node#15699, open for years). Speed in big folders is the main reason people leave Explorer.

## Decision
Add `packages/fs-native`, an N-API addon in C++ (node-addon-api) that calls `FindFirstFileExW` with `FindExInfoBasic` and `FIND_FIRST_EX_LARGE_FETCH` and returns columns (names, kinds, sizes, modified and created times, attributes). It accepts long paths and UNC. It is rebuilt for Electron's ABI in `app-deps` and unpacked from the asar, the same way better-sqlite3 is. File watching uses `@parcel/watcher`; thumbnails use Electron's `nativeImage.createThumbnailFromPath`. Node's `fs` stays the fallback when the addon fails to load.

## Consequences
- Measured 2026-11-06 (step 4, Node 24, warm cache, this PC): 100,000 entries with sizes and dates in 116 ms, against 4 to 4.7 s for `fs.readdir` plus `fs.stat`.
- C++ to maintain, and a rebuild on every Electron upgrade; the release workflow builds it.
- Memory and cold start stay Electron-sized; this ADR does not address them.
