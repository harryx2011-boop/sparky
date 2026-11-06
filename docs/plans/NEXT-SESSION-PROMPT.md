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
- Sparky 2.0 file manager: spec S1-S33 and ADRs 0001/0002 on main (approved on sparky-2). Branch sparky-2 has the three main-window comps as real React (A Workbench, B Live Wire, C Frost) at http://localhost:4601/prototypes/file-manager/ under npm run dev:ui -w @sparky/desktop, built from shadcn/ui (apps/desktop/components.json, new) and React Bits CircularText + ClickSpark for the convert wheel. Harry picked C · Frost (D-2.0-8); spec agreed and ADRs Accepted. Phase 1 step 4 done: packages/fs-native lists 100k entries in 116 ms (11 tests pass, UNC test skips on this PC).
- main: 1.3.0 in the manifests, installed locally, not tagged or released. Latest published release 1.1.1.
- Transcript op and progress bar changes are on main, not in the installed app.
- Untracked in the live checkout (not repo content): .aether/, .worktrees/, design/.

Next steps:
0. Sparky 2.0 on sparky-2: Phase 1 steps 4-6 done (fs-native lister packed outside the asar; `window.sparky.folders` lists and watches folders). Next: step 7 (startup order: window first, engine lazy, encoder probe cached), then Phase 2 step 8 (Frost tokens). To drive the dev app from a script: unset `ELECTRON_RUN_AS_NODE` (VS Code sets it) and pass `--user-data-dir=<scratch>` when the installed Sparky is open. UI work loads the website-design skill first (shadcn/ui, then Watermelon/Componentry, then React Bits).
1. Harry reviews and merges setup-revamp (CLAUDE.md, docs/plans set, archived 1.1 plan, context.md note).
2. Rebuild the installed app: node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky (use --no-test).
3. Memory folder for sparky (SPK-2) is handled by the memory track, not this repo.
4. Decide whether to tag 1.3.0 and publish a release (Harry's call).
```
