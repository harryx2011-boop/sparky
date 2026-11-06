Status: PLANNED

# Sparky 2.0: file manager

**Goal:** turn Sparky into a full Windows file manager, restyled close to Atlas, where every file action is an engine op that the Queue, CLI, HTTP API and MCP server get for free.

Research behind it: `D:\sparky\reports\Sparky file manager remap.md` (notes in `D:\sparky\research_notes\Sparky file manager remap\`). Decision IDs: `DECISIONS.md`, section "Sparky 2.0".

## Decisions (Harry, 2026-11-05)

| ID | Question | Answer |
|---|---|---|
| D-2.0-1 | How far | Full file manager now, not a Browse page first |
| D-2.0-2 | UI change | Atlas-style restyle: denser rows, themes, radial convert wheel |
| D-2.0-3 | Stack | Stay on Electron, with native addons; no Tauri rewrite |
| D-2.0-4 | Release | Sparky 2.0 in place: same app, installer and auto-update; Convert, Download and Tools stay inside |
| D-2.0-5 | Extras in 2.0 | Batch rename, archives as folders, tags and folder sizes, cloud and network drives (all four) |
| D-2.0-6 | Look | Close to Atlas: translucent panels, a theme set. Replaces the "lime is the one accent" rule for non-default themes; the default theme keeps lime |
| D-2.0-7 | Windows depth | Sparky's own right-click menu only, plus "Open in Explorer"; no hosting of other apps' shell menu items, no Win+E takeover |

Defaults I picked (not asked; change any of them before its phase starts):

- **Ops first.** Copy, move, rename, delete, mkdir, batch rename, extract and pack are engine ops in `packages/engine/src/ops/`, shown in the Queue. Agents reach them only in the `all` MCP profile, behind the existing path guard; delete for agents is trash-only.
- **Native lister.** One N-API addon, `packages/fs-native` (C++ with node-addon-api): `FindFirstFileExW` + `FIND_FIRST_EX_LARGE_FETCH` for listing with size and dates, `ReadDirectoryChangesW` watching is left to `@parcel/watcher`. Prebuilt for Electron's ABI the way better-sqlite3 is.
- **Search:** Everything SDK when Everything is running, else Sparky's own name index (SQLite FTS5 in the app data DB) built in the background per opened root.
- **Cloud:** bundled rclone (MIT) driven through `rclone rcd` (its local remote-control API) for listing and transfers. No drive mounting, so no WinFsp. SMB and UNC paths go through the native lister directly.
- **Archives:** browse and extract through the 7-Zip binary (check what `scripts/fetch-tools.mjs` bundles first; add `7z.exe` if missing).
- **Licence line:** Atlas is AGPL and its name and logo are excluded. Study its ideas and screenshots; copy no code, assets or theme files. Public palettes (Nord, Dracula, Rosé Pine) come from their own MIT sources.

## Out of scope for 2.0

Other apps' Explorer menu items, replacing Explorer as the default, encrypted folders, the disk-space map and cleaner, an extension store, Miller columns, macOS and Linux, mounting cloud drives as letters.

## Steps

Each step is one commit. Verify commands run from the repo root. `npm run check` needs `SPARKY_TEST_BIN=D:/sparky/sparky/apps/desktop/resources/bin`; run long suites in the background.

### Phase 0: spec and design (no source code)

1. **Spec.** `docs/specs/file-manager.md` (spec-driven skill): behaviours as Given/When/Then scenarios S1…Sn for listing, selection, file ops and undo, tabs and panes, command bar, search, preview, extras, cloud; each maps to one test named `S<n>: …`. Verify: Harry reads it; every phase below names its scenarios.
2. **ADR.** `docs/adr/0001-file-ops-as-engine-ops.md` and `0002-native-fs-addon.md` (context, decision, consequences). Verify: files exist with Status: Accepted after Harry's nod.
3. **Three design directions.** Three real React comps of the main window, built from the library parts the app will ship with, in `apps/desktop/src/renderer/prototypes/file-manager/` and served by `npm run dev:ui -w @sparky/desktop` at `http://localhost:4601/prototypes/file-manager/`. Screenshots and critique in `docs/design/2.0/` (the root `design/` folder is untracked scratch). Harry picks one. Verify: screenshots shown; pick recorded as D-2.0-8.

   Comp brief (Harry, 2026-11-06, `website-design` interview):

   | Question | Answer |
   |---|---|
   | Format | Real React comps (not static HTML), so the winner becomes Phase 2's starting code |
   | What varies | Three moods on the same bones: calm and dense, bold lime, glassy and translucent |
   | Component sources | shadcn/ui for base parts, Watermelon UI and Componentry for richer parts, React Bits for 1-2 signature pieces. No motion gallery (retired from the harness the same day) |
   | Signature motion | The convert wheel |
   | Default view | Details list |
   | Convert, Download, Tools | A sidebar section under the drives |
   | Inspector | Opens when a file is selected |
   | Fonts | Keep Satoshi and IBM Plex Mono |

### Phase 1: foundations

4. **`packages/fs-native` addon:** `list(path) -> { names, kinds, sizes, mtimes, ctimes, attrs }` as columns, long paths and UNC accepted. Verify: `npm test -w @sparky/fs-native` (5k and 100k entry fixtures; asserts the 100k list returns under 300 ms on a warm cache).
5. **Electron build wiring:** addon rebuilt for Electron in `app-deps`, unpacked in asar, packaged. Verify: `npm run package:win`, then the installed app lists `C:\Windows\System32`.
6. **Listing IPC:** `fs:list` streams the first 200 rows, then the rest as columnar transferable buffers; `fs:watch` pushes adds, removes and renames via `@parcel/watcher`. Verify: `npm test -w @sparky/desktop` (main-side tests with a temp folder).
7. **Startup order:** window first, engine started lazily on the first op or Queue view; encoder probe cached by ffmpeg path and mtime (ROADMAP open item). Verify: time to first window logged, under 1 s on a warm start; engine suite green.

### Phase 2: shell, theme system and Browse

8. **Theme tokens:** theme registry in `packages/ui` (default Sparky dark with lime, Sparky light, plus the token slots for translucent surfaces); acrylic/Mica window material on Windows 11 with an opaque fallback. Verify: token check (`apps/desktop` 0 misses), typecheck.
9. **New shell layout:** title bar with tab strip, Places sidebar (Quick access, drives, Downloads\Sparky, then Convert, Download, Tools, Queue, History), pane area, inspector slot, status bar, job pill replacing the queue dock. Old pages render inside the pane area. Verify: `npm run dev:ui -w @sparky/desktop` on 4601, screenshots against the picked comp.
10. **Details, List and Grid views:** TanStack Virtual, sortable columns, density control (row height and font size). Verify: desktop tests; 100k-row folder scrolls without dropped frames (Performance trace).
11. **Navigation:** breadcrumb that turns into an editable path, back/forward/up, keyboard selection (arrows, Shift, Ctrl, Ctrl+A, type-to-select), open with default app, reveal. Verify: scenario tests S-nav.
12. **Thumbnails and icons:** `nativeImage.createThumbnailFromPath` for visible rows only, cached per path+mtime; per-file icons for .exe and .lnk. Verify: Grid view of a 2,000-photo folder renders thumbnails without blocking scroll.
13. **Drag and drop:** drag out via `webContents.startDrag`, drag in from Explorer, drop target accent border. Verify: manual run, files land where dropped.
14. **Sparky right-click menu and convert wheel:** a typeable, searchable menu built from the op registry (Convert to…, Compress, OCR, PDF tools, Open in Explorer); a radial convert wheel whose targets depend on the selected type. Verify: scenario tests; running "Convert to webp" from the menu puts a job in the Queue.

### Phase 3: file operations

15. **Ops `file.copy`, `file.move`, `file.mkdir`, `file.rename`:** conflict policy (ask, skip, keep both, replace), progress and cancel, same-volume move as rename. Verify: `npm test -w @sparky/engine` (temp-folder tests, cancel mid-copy leaves no partial file).
16. **`file.delete`:** Recycle Bin by default via the host `trash` capability; permanent delete only with a typed confirm in the UI. Verify: engine tests.
17. **Undo journal:** each op writes reverse steps to the history DB (`PRAGMA user_version` bump); Ctrl+Z undoes the last op group. Verify: tests for undo of copy, move, rename and trash.
18. **Preview before run:** batch ops over 20 files show the planned result first (validate, preview, execute). Verify: scenario test.
19. **Agent wiring:** the new ops in the `all` profile, guarded; `sparky file copy …` in the CLI from the registry. Verify: `packages/cli/test/mcp-limits.test.ts` extended; an MCP call outside the roots is refused.

### Phase 4: tabs, panes, command bar, search

20. **Tabs and split panes:** new tab, close, reorder, Ctrl+T/W/Tab; vertical and horizontal split, drag between panes copies or moves (Shift moves); session restore on launch. Verify: scenario tests.
21. **Ctrl+K command bar:** paths, open folders, every op, settings; a pasted link starts a download. Verify: scenario tests; pasting a YouTube link queues a download.
22. **Search:** Everything SDK when its service is up, else the background FTS5 name index; results as a virtual folder. Verify: tests with and without Everything; a name search over 100k indexed files answers under 200 ms.

### Phase 5: preview and inspector

23. **Space preview:** images, video and audio (the bundled ffmpeg makes a proxy when the browser can't play it), PDF (pdf.js), text and code. Verify: one fixture per kind opens.
24. **Inspector panel:** preview, details (size, dates, dimensions, duration, pages), format-aware actions. Verify: scenario tests.

### Phase 6: extras

25. **Batch rename** as an op with a live preview table (find/replace, regex, numbering, case, date tokens). Verify: engine tests, undo works.
26. **Archives as folders:** browse zip, 7z, rar, tar, iso via 7-Zip listing; extract and pack as ops. Verify: fixtures for each type list and extract.
27. **Tags:** colour tags stored in the app DB keyed by volume ID + file ID (survive renames), a tag filter in Places. Verify: tests; a tagged file keeps its tag after a rename.
28. **Folder sizes:** background size walk with a cache and a Details column. Verify: tests against a known tree.

### Phase 7: cloud and network

29. **Network paths:** SMB and UNC in the lister, mapped drives in Places, a "Connect to server" dialog. Verify: list a `\\localhost\c$` share.
30. **rclone remotes:** bundle rclone in `fetch-tools`, drive `rclone rcd`; Google Drive, OneDrive, Dropbox, SFTP, WebDAV and FTP connect through rclone's own sign-in; listing and copy as ops. Verify: SFTP against a local test server in tests; Google Drive checked by hand.

### Phase 8: themes and polish

31. **Theme set:** Sparky dark (default), Sparky light, Graphite, Midnight, Nord, Dracula, Rosé Pine; translucent and opaque variants. Verify: token check, contrast check for each theme (text 4.5:1).
32. **Motion and polish pass:** design-review of the whole window against the comp; no exit animations on folder changes. Verify: screenshots of each theme.

### Phase 9: release 2.0

33. **Docs and site:** README, context.md, site sections (file manager hero, screenshots), `gen-site-ops`, sitemap rows. Verify: `npm run build -w @sparky/web`.
34. **Version and release:** 2.0.0 in every manifest, settings migration from 1.x, release notes; tag push is Harry's go. Verify: `npm run check`, `npm run package:win`, install over 1.3.0 keeps settings and history.

## Risks and rollback

- **"Slow Electron" verdict.** Memory stays several times a native app's. Mitigate with the native lister, virtual lists, lazy engine and a warm tray window; measure folder-open times in step 4 and 10 and publish only measured numbers.
- **Data loss in copy, move and delete.** Mitigate with temp-folder tests for every op, Recycle Bin default, undo journal, preview before batch runs, and a partial-file cleanup on cancel.
- **Native addon upkeep.** Each Electron upgrade needs a rebuild; CI builds it in the release workflow.
- **Scope.** Thirty-four steps. Phases 6 and 7 are the first to slip to 2.1 if time runs long; say so before cutting.
- **Looking like a clone.** D-2.0-6 chose close to Atlas; the comps in step 3 keep Sparky's mark and default lime theme so screenshots stay distinct. No Atlas code, assets or name.
- **Rollback.** All work on branch `sparky-2`; `main` keeps 1.3.0 shippable. Users on 1.x stay there until 2.0.0 is tagged; a bad 2.0 release is pulled by publishing 2.0.1 with the fix (auto-update only moves forward).
