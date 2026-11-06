Status: IN PROGRESS

# Next session prompt

```
Sparky repo: D:\sparky\sparky (live). Sparky 2.0 work is on branch sparky-2 (local, not pushed); main is 7 commits ahead of origin, unpushed. Setup revamp work is on branch setup-revamp in C:\Builds\setup-revamp\wt\sparky_sparky (local commit, not pushed).

Read first, in order:
1. context.md (canonical state)
2. docs/plans/README.md
3. docs/plans/ROADMAP.md (open items)
4. docs/plans/DECISIONS.md (D-2.0-1..7)
5. docs/plans/2026-11-05-sparky-2-file-manager.md (Sparky 2.0 file manager plan; step 3 has the comp brief)
7. docs/design/2.0/README.md (the three directions and their critique)
6. D:\sparky\reports\Sparky file manager remap.md (research behind it, outside the repo)

State:
- Sparky 2.0 file manager: spec S1-S33 (draft) and ADRs 0001/0002 (Proposed) on main. Branch sparky-2 has the three main-window comps as real React (A Workbench, B Live Wire, C Frost) at http://localhost:4601/prototypes/file-manager/ under npm run dev:ui -w @sparky/desktop, built from shadcn/ui (apps/desktop/components.json, new) and React Bits CircularText + ClickSpark for the convert wheel. Waiting on Harry: pick a direction (D-2.0-8), agree the spec, accept the ADRs.
- main: 1.3.0 in the manifests, installed locally, not tagged or released. Latest published release 1.1.1.
- Transcript op and progress bar changes are on main, not in the installed app.
- Untracked in the live checkout (not repo content): .aether/, .worktrees/, design/.

Next steps:
0. Sparky 2.0: record Harry pick as D-2.0-8 (DECISIONS.md and the plan), mark the spec agreed and ADRs Accepted, then Phase 1 step 4 (packages/fs-native, test-first) on sparky-2. UI work loads the website-design skill first (shadcn/ui, then Watermelon/Componentry, then React Bits).
1. Harry reviews and merges setup-revamp (CLAUDE.md, docs/plans set, archived 1.1 plan, context.md note).
2. Rebuild the installed app: node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky (use --no-test).
3. Memory folder for sparky (SPK-2) is handled by the memory track, not this repo.
4. Decide whether to tag 1.3.0 and publish a release (Harry's call).
```
