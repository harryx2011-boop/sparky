Status: IN PROGRESS

# Next session prompt

```
Sparky repo: D:\sparky\sparky (live). Sparky 2.0 work is on branch sparky-2 (local, not pushed); main is 7 commits ahead of origin, unpushed. Setup revamp work is on branch setup-revamp in C:\Builds\setup-revamp\wt\sparky_sparky (local commit, not pushed).

Read first, in order:
1. context.md (canonical state)
2. docs/plans/README.md
3. docs/plans/ROADMAP.md (open items)
4. docs/plans/DECISIONS.md (D-2.0-1..8)
5. docs/plans/2026-11-05-sparky-2-file-manager.md (Sparky 2.0 file manager plan; step 3 has the comp brief)
6. docs/design/2.0/README.md (the three directions; Frost picked)
7. D:\sparky\reports\Sparky file manager remap.md (research behind it, outside the repo)

State:
- Sparky 2.0 file manager: spec S1-S33 and ADRs 0001/0002 on main (approved on sparky-2). Branch sparky-2 has the three main-window comps as real React (A Workbench, B Live Wire, C Frost) at http://localhost:4601/prototypes/file-manager/ under npm run dev:ui -w @sparky/desktop, built from shadcn/ui (apps/desktop/components.json, new) and React Bits CircularText + ClickSpark for the convert wheel. Harry picked C · Frost (D-2.0-8); spec agreed and ADRs Accepted. Phase 1 done: packages/fs-native lists 100k entries in 116 ms (UNC test skips on this PC), packed outside the asar; window.sparky.folders lists (200 rows first) and watches folders; GPU probe cached so a warm engine start is ~20 ms. Nothing on sparky-2 is pushed.
- main: 1.3.0 in the manifests, installed locally, not tagged or released. Latest published release 1.1.1.
- Transcript op and progress bar changes are on main, not in the installed app.
- Untracked in the live checkout (not repo content): .aether/, .worktrees/, design/.

Next steps:
0. Sparky 2.0 on sparky-2: Phase 1 steps 4-6 done (fs-native lister packed outside the asar; `window.sparky.folders` lists and watches folders). Phase 1 complete (step 7: GPU probe cached, warm engine start ~20 ms). Phase 2 step 8 done (Frost shell tokens `--shell-*`, `.sp-shell`, `.sp-panel`). Step 9 done (Frost shell live in the app, acrylic on Windows 11). Step 10 done (Browse page in apps/desktop/src/renderer/src/browse/: Details/List/Grid on TanStack Virtual, density menu, Places with Quick access and drives; 100k files open in ~145 ms and scroll at 120 fps in the production preview). Next: step 11 (navigation: editable breadcrumb, back/forward/up history, keyboard selection, Shift/Ctrl multi-select with "N selected" in the status bar, type-to-select; tests S5-S9 in browse/*.test.ts), then step 12 (thumbnails). Open: look at the acrylic window by eye on an uncluttered desktop. To drive the dev app from a script: unset `ELECTRON_RUN_AS_NODE` (VS Code sets it) and pass `--user-data-dir=<scratch>` when the installed Sparky is open. UI work loads the website-design skill first (shadcn/ui, then Watermelon/Componentry, then React Bits).
1. Harry reviews and merges setup-revamp (CLAUDE.md, docs/plans set, archived 1.1 plan, context.md note).
2. Rebuild the installed app: node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky (use --no-test).
3. Memory folder for sparky (SPK-2) is handled by the memory track, not this repo.
4. Decide whether to tag 1.3.0 and publish a release (Harry's call).
```
